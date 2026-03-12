"use strict";

import "core-js";
import "./../style/visual.less";

import powerbi from "powerbi-visuals-api";
import * as d3 from "d3";

import {
    createTooltipServiceWrapper,
    ITooltipServiceWrapper
} from "powerbi-visuals-utils-tooltiputils";

import {
    VisualFormattingSettingsModel,
    formattingSettingsService
} from "./formattingSettings";

import { Settings } from "./settings";

// GeoJSON bundled as a webpack asset
const germanyGeoJSON = require("./../assets/germany-postal-codes.json");

import ISelectionId = powerbi.visuals.ISelectionId;
import IViewport = powerbi.IViewport;
import DataView = powerbi.DataView;
import DataViewCategoryColumn = powerbi.DataViewCategoryColumn;
import DataViewValueColumns = powerbi.DataViewValueColumns;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstanceEnumeration = powerbi.VisualObjectInstanceEnumeration;
import FormattingModel = powerbi.visuals.FormattingModel;
import ISelectionManager = powerbi.extensibility.ISelectionManager;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

// ----- Interfaces -----

interface MapDataPoint {
    postalCode: string;
    value: number | null;
    hexColor: string | null;
    tooltipValue: string | null;
    identity: ISelectionId;
}

interface MapViewModel {
    dataPoints: MapDataPoint[];
    dataMap: Map<string, MapDataPoint>;
    minValue: number;
    maxValue: number;
}

/** Typed GeoJSON feature as produced by Germany postal code GeoJSON files */
interface PlzFeature {
    type: "Feature";
    properties: Record<string, unknown>;
    geometry: { type: string; coordinates: unknown };
}

// ----- Color mode constants -----
const COLOR_MODE_RULES = "rules";
const COLOR_MODE_FIXED = "fixedValue";
const COLOR_MODE_SATURATION = "saturation";

// ----- Helper: extract PLZ from a GeoJSON feature's properties -----
function getPlz(properties: Record<string, unknown>): string {
    // Support the most common field names used in Germany postal code GeoJSON files
    const val = properties["plz"] ?? properties["PLZ"] ?? properties["postcode"] ?? properties["zip"] ?? "";
    return String(val);
}

export class Visual implements IVisual {
    private host: IVisualHost;
    private svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>;
    private mapGroup: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
    private tooltipServiceWrapper: ITooltipServiceWrapper;
    private selectionManager: ISelectionManager;

    private formattingSettings: VisualFormattingSettingsModel;
    private settings: Settings;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;

        this.svg = d3
            .select(options.element)
            .append("svg")
            .classed("filledMapGermany", true);

        this.mapGroup = this.svg.append("g")
            .classed("mapGroup", true);

        this.tooltipServiceWrapper = createTooltipServiceWrapper(
            this.host.tooltipService,
            options.element
        );

        this.selectionManager = this.host.createSelectionManager();

        this.formattingSettings = new VisualFormattingSettingsModel();
        this.settings = Settings.getDefault();
    }

    public update(options: VisualUpdateOptions): void {
        const dataView = options.dataViews && options.dataViews[0];

        if (
            !dataView ||
            !dataView.categorical ||
            !dataView.categorical.categories ||
            dataView.categorical.categories.length === 0
        ) {
            this.clear();
            return;
        }

        // Legacy settings (backward-compatible enumeration)
        this.settings = Settings.parse<Settings>(dataView);

        // Modern formatting model
        this.formattingSettings =
            formattingSettingsService.populateFormattingSettingsModel(
                VisualFormattingSettingsModel,
                dataView
            );

        const viewModel = this.transform(dataView);
        const viewport: IViewport = options.viewport;

        this.svg
            .attr("width", viewport.width)
            .attr("height", viewport.height);

        this.render(viewModel, viewport);
    }

    private clear(): void {
        this.mapGroup.selectAll("*").remove();
    }

    /**
     * Transform the categorical DataView into a MapViewModel.
     *   categories[0] = PostalCode (Grouping)
     *   values[?]     = Value measure      (role "Value")
     *   values[?]     = Color measure      (role "Color")
     *   values[?]     = Tooltips measure   (role "Tooltips")
     */

    private transform(dataView: DataView): MapViewModel {
        const categorical = dataView.categorical;

        if (!categorical.categories || categorical.categories.length === 0) {
            return {
                dataPoints: [],
                dataMap: new Map<string, MapDataPoint>(),
                minValue: 0,
                maxValue: 1
            };
        }

        const categoryColumn: DataViewCategoryColumn = categorical.categories[0];
        const valueColumns: DataViewValueColumns | undefined = categorical.values;

        // Use PLZ exactly as provided, as string
        const postalCodes = categoryColumn.values.map(c => String(c ?? ""));

        let valueColIdx = -1;
        let colorColIdx = -1;
        let tooltipColIdx = -1;

        if (valueColumns) {
            for (let i = 0; i < valueColumns.length; i++) {
                const roles = valueColumns[i].source.roles ?? {};
                if (roles["Value"]) {
                    valueColIdx = i;
                } else if (roles["Color"]) {
                    colorColIdx = i;
                } else if (roles["Tooltips"]) {
                    tooltipColIdx = i;
                }
            }
        }

        const dataPoints: MapDataPoint[] = [];
        const dataMap = new Map<string, MapDataPoint>();

        let minValue = Infinity;
        let maxValue = -Infinity;

        for (let idx = 0; idx < postalCodes.length; idx++) {
            const postalCode = postalCodes[idx];

            const value: number | null =
                valueColIdx >= 0
                    ? (valueColumns![valueColIdx].values[idx] as number | null)
                    : null;

            const hexColor: string | null =
                colorColIdx >= 0 && valueColumns![colorColIdx].values[idx] != null
                    ? String(valueColumns![colorColIdx].values[idx])
                    : null;

            const tooltipValue: string | null =
                tooltipColIdx >= 0 && valueColumns![tooltipColIdx].values[idx] != null
                    ? String(valueColumns![tooltipColIdx].values[idx])
                    : null;

            if (value != null && !isNaN(value)) {
                minValue = Math.min(minValue, value);
                maxValue = Math.max(maxValue, value);
            }

            const identity = this.host
                .createSelectionIdBuilder()
                .withCategory(categoryColumn, idx)
                .createSelectionId();

            const dp: MapDataPoint = { postalCode, value, hexColor, tooltipValue, identity };
            dataPoints.push(dp);
            dataMap.set(postalCode, dp);
        }

        if (!isFinite(minValue)) { minValue = 0; }
        if (!isFinite(maxValue)) { maxValue = 1; }
        if (minValue === maxValue) { maxValue = minValue + 1; }

        return { dataPoints, dataMap, minValue, maxValue };
    }

    private render(viewModel: MapViewModel, viewport: IViewport): void {
        this.mapGroup.selectAll("*").remove();

        const colorOpts = this.formattingSettings.colorOptionsCard;
        const mapOpts = this.formattingSettings.mapOptionsCard;

        // Read color mode from the enum dropdown value
        const colorModeEnum = colorOpts.colorMode.value as { value: string };
        const colorMode: string = colorModeEnum?.value ?? COLOR_MODE_RULES;

        const colorLow = colorOpts.colorLow.value.value;
        const colorHigh = colorOpts.colorHigh.value.value;
        const defaultColor = colorOpts.defaultColor.value.value;
        const borderColor = mapOpts.borderColor.value.value;
        const borderWidth = mapOpts.borderWidth.value;
        const backgroundColor = mapOpts.backgroundColor.value.value;

        // Apply background color to the SVG element
        this.svg.style("background-color", backgroundColor);

        // Linear color interpolator for "rules" mode
        const colorScale = d3.scaleLinear<string>()
            .domain([viewModel.minValue, viewModel.maxValue])
            .range([colorLow, colorHigh])
            .clamp(true);

        // Determine the fill color for a given data point
        const getFill = (dp: MapDataPoint | undefined): string => {
            if (!dp) {
                return defaultColor;
            }

            if (colorMode === COLOR_MODE_FIXED) {
                return dp.hexColor ?? defaultColor;
            }

            if (dp.value == null || isNaN(dp.value)) {
                return defaultColor;
            }

            if (colorMode === COLOR_MODE_SATURATION) {
                // Normalize value to [0, 1] and use it as the HSL saturation
                const normalized = (dp.value - viewModel.minValue) /
                    (viewModel.maxValue - viewModel.minValue);
                const baseHsl = d3.hsl(colorHigh);
                baseHsl.s = Math.max(0, Math.min(1, normalized));
                return baseHsl.toString();
            }

            // Default: rules — linear interpolation between colorLow and colorHigh
            return colorScale(dp.value);
        };

        // Build D3 geo projection fitting the full viewport
        const projection = d3.geoMercator()
            .fitSize(
                [Math.max(viewport.width, 1), Math.max(viewport.height, 1)],
                germanyGeoJSON
            );

        const pathGenerator = d3.geoPath().projection(projection);

        const features = (germanyGeoJSON.features ?? []) as PlzFeature[];

        const paths = this.mapGroup
            .selectAll<SVGPathElement, PlzFeature>("path.postal-region")
            .data(features)
            .enter()
            .append("path")
            .classed("postal-region", true)
            .attr("d", (d: PlzFeature) => pathGenerator(d as d3.GeoPermissibleObjects) ?? "")
            .attr("fill", (d: PlzFeature) => {
                const plz = getPlz(d.properties);
                return getFill(viewModel.dataMap.get(plz));
            })
            .attr("stroke", borderColor)
            .attr("stroke-width", borderWidth);

        // --- Click selection ---
        paths.on("click", (event: MouseEvent, d: PlzFeature) => {
            const plz = getPlz(d.properties);
            const dp = viewModel.dataMap.get(plz);
            if (!dp) { return; }

            const isMultiSelect = event.ctrlKey || event.metaKey;
            this.selectionManager
                .select(dp.identity, isMultiSelect)
                .then((selectionIds: ISelectionId[] | undefined) => {
                    paths.style("opacity", (f: PlzFeature) => {
                        if (!selectionIds || selectionIds.length === 0) {
                            return 1;
                        }
                        const fPlz = getPlz(f.properties);
                        const fdp = viewModel.dataMap.get(fPlz);
                        return fdp && selectionIds.indexOf(fdp.identity) !== -1 ? 1 : 0.4;
                    });
                });
            event.stopPropagation();
        });

        this.svg.on("click", () => {
            this.selectionManager.clear().then(() => {
                paths.style("opacity", 1);
            });
        });

        // --- Tooltips ---
        this.tooltipServiceWrapper.addTooltip(
            paths,
            (d: PlzFeature): VisualTooltipDataItem[] => {
                const plz = getPlz(d.properties);
                const dp = viewModel.dataMap.get(plz);

                const items: VisualTooltipDataItem[] = [
                    { displayName: "Postal Code", value: plz }
                ];

                if (dp) {
                    if (dp.value != null) {
                        items.push({ displayName: "Value", value: String(dp.value) });
                    }
                    if (dp.hexColor != null) {
                        items.push({ displayName: "Color", value: dp.hexColor });
                    }
                    if (dp.tooltipValue != null) {
                        items.push({ displayName: "Tooltip", value: dp.tooltipValue });
                    }
                }

                return items;
            },
            (d: PlzFeature): ISelectionId | undefined => {
                const plz = getPlz(d.properties);
                return viewModel.dataMap.get(plz)?.identity;
            }
        );
    }

    public enumerateObjectInstances(
        options: EnumerateVisualObjectInstancesOptions
    ): VisualObjectInstanceEnumeration {
        return Settings.enumerateObjectInstances(
            this.settings || Settings.getDefault(),
            options
        );
    }

    public getFormattingModel(): FormattingModel {
        return formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }
}
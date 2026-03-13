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

// ----- Helper: extract PLZ from a GeoJSON feature's properties -----
// IMPORTANT: your GeoJSON uses "postcode", so we prioritize that.
// Also trim spaces to match Power BI text exactly.
function getPlz(properties: Record<string, unknown>): string {
    const val =
        properties["postcode"] ??
        properties["plz"] ??
        properties["PLZ"] ??
        properties["zip"] ??
        "";
    return String(val ?? "").trim();
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

        // Modern formatting model (still loaded, but we don’t rely on it for debug colors)
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

        // Normalize PLZ coming from Power BI (string + trim)
        const postalCodes = categoryColumn.values.map(c => String(c ?? "").trim());

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

        // DEBUG: ignore formatting pane for now, hard-code very visible colors
        const defaultColor = "#FF00FF";     // bright magenta for "no data"
        const colorLow = "#FFFFCC";         // pale yellow
        const colorHigh = "#FF0000";        // red
        const borderColor = "#000000";      // black border
        const borderWidth = 0.5;
        const backgroundColor = "#FFFFFF";  // white background

        // Apply background color to the SVG element
        this.svg.style("background-color", backgroundColor);

        // Linear color interpolator (always "rules" mode in this debug version)
        const colorScale = d3.scaleLinear<string>()
            .domain([viewModel.minValue, viewModel.maxValue])
            .range([colorLow, colorHigh])
            .clamp(true);

        // Determine the fill color for a given data point
        const getFill = (dp: MapDataPoint | undefined): string => {
            if (!dp) {
                return defaultColor;
            }

            if (dp.value == null || isNaN(dp.value)) {
                return defaultColor;
            }

            // Always use rules: linear interpolation between colorLow and colorHigh
            return colorScale(dp.value);
        };

        // Build D3 geo projection fitting the full viewport
        const projection = d3.geoMercator()
            .fitSize(
                [Math.max(viewport.width, 1), Math.max(viewport.height, 1)],
                germanyGeoJSON as any
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
                const dp = viewModel.dataMap.get(plz);
                return getFill(dp);
            })
            .style("fill", (d: PlzFeature) => {
                const plz = getPlz(d.properties);
                const dp = viewModel.dataMap.get(plz);
                return getFill(dp);
            })
            .attr("stroke", borderColor)
            .style("stroke", borderColor)
            .attr("stroke-width", borderWidth)
            .style("stroke-width", `${borderWidth}px`);

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

        // --- Tooltips (DEBUG mode) ---
        this.tooltipServiceWrapper.addTooltip(
            paths,
            (d: PlzFeature): VisualTooltipDataItem[] => {
                const plz = getPlz(d.properties);
                const dp = viewModel.dataMap.get(plz);

                const items: VisualTooltipDataItem[] = [
                    { displayName: "DEBUG PLZ", value: `PLZ_FROM_GEOJSON=${plz}` }
                ];

                if (dp) {
                    if (dp.value != null) {
                        items.push({ displayName: "DEBUG Value", value: String(dp.value) });
                    }
                    if (dp.hexColor != null) {
                        items.push({ displayName: "DEBUG Color", value: dp.hexColor });
                    }
                    if (dp.tooltipValue != null) {
                        items.push({ displayName: "DEBUG Tooltip", value: dp.tooltipValue });
                    }
                } else {
                    items.push({ displayName: "DEBUG Status", value: "NO MATCH IN dataMap" });
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
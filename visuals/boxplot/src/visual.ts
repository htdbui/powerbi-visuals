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
import IVisualEventService = powerbi.extensibility.IVisualEventService;
import ILocalizationManager = powerbi.extensibility.ILocalizationManager;

interface BoxplotDataPoint {
    category: string;
    min: number;
    q1: number;
    median: number;
    mean: number;
    q3: number;
    max: number;
    identity: ISelectionId;
}

interface BoxplotViewModel {
    dataPoints: BoxplotDataPoint[];
    categories: string[];
}

export class Visual implements IVisual {
    private host: IVisualHost;
    private localizationManager: ILocalizationManager;
    private element: HTMLElement;
    private svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>;
    private mainGroup: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
    private tooltipServiceWrapper: ITooltipServiceWrapper;
    private selectionManager: ISelectionManager;
    private events: IVisualEventService;

    private formattingSettings: VisualFormattingSettingsModel;
    private settings: Settings;

    private isHighContrast: boolean = false;
    private foregroundColor: string = "#000000";
    private backgroundColor: string = "#ffffff";
    private foregroundSelectedColor: string = "#000000";
    private allowInteractions: boolean = true;

    private landingPage: d3.Selection<HTMLDivElement, unknown, null, undefined> | null = null;
    private isLandingPageVisible: boolean = false;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.localizationManager = this.host.createLocalizationManager();
        this.element = options.element;
        this.events = options.host.eventService;

        this.svg = d3
            .select(options.element)
            .append("svg")
            .classed("boxplotVisual", true)
            .attr("tabindex", 0)
            .attr("role", "application");

        this.mainGroup = this.svg
            .append("g")
            .classed("boxplotMainGroup", true);

        this.tooltipServiceWrapper = createTooltipServiceWrapper(
            this.host.tooltipService,
            options.element
        );

        this.selectionManager = this.host.createSelectionManager();

        this.formattingSettings = new VisualFormattingSettingsModel();
        this.settings = Settings.getDefault();

        this.updateColorMode();
        this.handleContextMenu();
    }

    public update(options: VisualUpdateOptions): void {
        this.events.renderingStarted(options);

        try {
            const dataView = options.dataViews && options.dataViews[0];

            this.allowInteractions = this.host.hostCapabilities
                ? this.host.hostCapabilities.allowInteractions
                : true;

            if (!dataView || !dataView.metadata || !dataView.metadata.columns || dataView.metadata.columns.length === 0) {
                this.renderLandingPage();
                this.events.renderingFinished(options);
                return;
            }

            this.removeLandingPage();

            if (
                !dataView.categorical ||
                !dataView.categorical.categories ||
                dataView.categorical.categories.length === 0 ||
                !dataView.categorical.values ||
                dataView.categorical.values.length === 0
            ) {
                this.clear();
                this.events.renderingFinished(options);
                return;
            }

            this.settings = Settings.parse<Settings>(dataView);

            this.formattingSettings =
                formattingSettingsService.populateFormattingSettingsModel(
                    VisualFormattingSettingsModel,
                    dataView
                );

            this.updateColorMode();

            const viewModel = this.transform(dataView);
            const viewport: IViewport = options.viewport;

            this.svg
                .attr("width", viewport.width)
                .attr("height", viewport.height);

            this.render(viewModel, viewport);

            this.events.renderingFinished(options);
        } catch (error) {
            this.events.renderingFailed(options, error);
        }
    }

    private t(key: string, fallback: string): string {
        const localized = this.localizationManager.getDisplayName(key);

        if (!localized || localized === key) {
            return fallback;
        }

        return localized;
    }

    private updateColorMode(): void {
        const colorPalette = this.host.colorPalette;
        this.isHighContrast = colorPalette.isHighContrast;

        if (this.isHighContrast) {
            this.foregroundColor = colorPalette.foreground.value;
            this.backgroundColor = colorPalette.background.value;
            this.foregroundSelectedColor = colorPalette.foregroundSelected.value;
        } else {
            this.foregroundColor = "#000000";
            this.backgroundColor = "#ffffff";
            this.foregroundSelectedColor = "#000000";
        }
    }

    private handleContextMenu(): void {
        this.svg.on("contextmenu", (event: MouseEvent) => {
            if (!this.allowInteractions) {
                return;
            }

            const target = event.target as Element;
            const datum = d3.select(target).datum() as BoxplotDataPoint | undefined;

            this.selectionManager.showContextMenu(
                datum && datum.identity ? datum.identity : {},
                {
                    x: event.clientX,
                    y: event.clientY
                }
            );

            event.preventDefault();
            event.stopPropagation();
        });
    }

    private renderLandingPage(): void {
        this.clear();

        if (this.isLandingPageVisible) {
            return;
        }

        this.landingPage = d3
            .select(this.element)
            .append("div")
            .classed("boxplotLandingPage", true);

        this.landingPage
            .append("div")
            .classed("boxplotLandingTitle", true)
            .text(this.t("Landing_Title", "Box Plot"));

        this.landingPage
            .append("div")
            .classed("boxplotLandingText", true)
            .text(this.t("Landing_Text", "Add fields to build the box plot."));

        const hint = this.landingPage
            .append("div")
            .classed("boxplotLandingHint", true);

        const line1 = hint.append("div");
        line1.append("span")
            .classed("boxplotLandingLabel", true)
            .text(this.t("Landing_Category_Label", "Category: "));
        line1.append("span")
            .text(this.t("Landing_Category_Value", "group name"));

        const line2 = hint.append("div");
        line2.append("span")
            .classed("boxplotLandingLabel", true)
            .text(this.t("Landing_Sampling_Label", "Sampling: "));
        line2.append("span")
            .text(this.t("Landing_Sampling_Value", "one record or sample inside each category"));

        const line3 = hint.append("div");
        line3.append("span")
            .classed("boxplotLandingLabel", true)
            .text(this.t("Landing_Values_Label", "Values: "));
        line3.append("span")
            .text(this.t("Landing_Values_Value", "numeric measure used to compute the distribution"));

        this.isLandingPageVisible = true;
    }

    private removeLandingPage(): void {
        if (this.landingPage) {
            this.landingPage.remove();
            this.landingPage = null;
        }

        this.isLandingPageVisible = false;
    }

    private clear(): void {
        this.mainGroup.selectAll("*").remove();
    }

    private transform(dataView: DataView): BoxplotViewModel {
        const categorical = dataView.categorical;
        const categoryColumn: DataViewCategoryColumn = categorical.categories![0];
        const valueColumns: DataViewValueColumns = categorical.values!;
        const valuesMeasure = valueColumns[0];
        const categories = categoryColumn.values.map(c => String(c));

        const grouped: { [category: string]: number[] } = {};

        for (let idx = 0; idx < categories.length; idx++) {
            const categoryName = categories[idx];

            if (!grouped[categoryName]) {
                grouped[categoryName] = [];
            }

            const value = valuesMeasure.values[idx] as number;
            if (value != null && !isNaN(value)) {
                grouped[categoryName].push(value);
            }
        }

        const dataPoints: BoxplotDataPoint[] = [];

        for (const category of Object.keys(grouped)) {
            const values = grouped[category].slice().sort((a, b) => a - b);
            if (values.length === 0) {
                continue;
            }

            const min = values[0];
            const max = values[values.length - 1];
            const q1 = quantile(values, 0.25);
            const median = quantile(values, 0.5);
            const q3 = quantile(values, 0.75);
            const mean = values.reduce((a, b) => a + b, 0) / values.length;

            const categoryIndex = categories.indexOf(category);

            const identity = this.host
                .createSelectionIdBuilder()
                .withCategory(categoryColumn, categoryIndex)
                .createSelectionId();

            dataPoints.push({
                category,
                min,
                q1,
                median,
                mean,
                q3,
                max,
                identity
            });
        }

        return {
            dataPoints,
            categories: Object.keys(grouped)
        };
    }

    private render(viewModel: BoxplotViewModel, viewport: IViewport): void {
        let data = viewModel.dataPoints.slice();
        this.mainGroup.selectAll("*").remove();

        if (data.length === 0) {
            return;
        }

        const allValues = data
            .reduce(
                (acc, d) => acc.concat([d.min, d.q1, d.median, d.q3, d.max]),
                [] as number[]
            )
            .filter(v => v != null && !isNaN(v));

        if (allValues.length === 0) {
            return;
        }

        const dp = this.formattingSettings.dataPointCard;
        const xAxisSettings = this.formattingSettings.xAxisCard;
        const yAxisSettings = this.formattingSettings.yAxisCard;
        const shapesSettings = this.formattingSettings.shapesCard;
        const chartOptionsSettings = this.formattingSettings.chartOptionsCard;
        const categoryLabelsSettings = this.formattingSettings.categoryLabelsCard;

        const color = this.isHighContrast
            ? this.foregroundColor
            : dp.fill.value.value;

        const medianColor = this.isHighContrast
            ? this.backgroundColor
            : dp.medianColor.value.value;

        const meanColor = this.isHighContrast
            ? this.foregroundSelectedColor
            : dp.meanColor.value.value;

        let orientation = "vertical";
        if (chartOptionsSettings?.orientation?.value) {
            const orientationVal = chartOptionsSettings.orientation.value;
            orientation = typeof orientationVal === "object" && orientationVal !== null
                ? (orientationVal as { value: string }).value
                : String(orientationVal);
        }

        const isHorizontal = orientation === "horizontal";

        let sortByMedian = false;
        if (chartOptionsSettings?.sortByMedian?.value !== undefined) {
            sortByMedian = chartOptionsSettings.sortByMedian.value;
        }

        if (sortByMedian) {
            data.sort((a, b) => a.median - b.median);
        }

        let labelLayoutMode = "none";
        if (categoryLabelsSettings?.layoutMode?.value) {
            const modeVal = categoryLabelsSettings.layoutMode.value;
            labelLayoutMode = typeof modeVal === "object" && modeVal !== null
                ? (modeVal as { value: string }).value
                : String(modeVal);
        }

        const maxWrapLines = Math.max(1, Number(categoryLabelsSettings.maxLines.value || 2));
        const rawRotation = Number(categoryLabelsSettings.rotation.value || 0);
        const labelRotation = Math.max(0, Math.min(90, rawRotation));

        const baseMargin = { top: 20, right: 20, bottom: 40, left: 50 };
        const margin = { ...baseMargin };

        if (isHorizontal) {
            const fontSize = yAxisSettings.fontSize.value || 11;
            const maxLabelLen = d3.max(data, d => (d.category ? d.category.length : 0)) || 0;
            const approxLabelWidth = maxLabelLen * fontSize * 0.6;
            margin.left = Math.max(baseMargin.left, approxLabelWidth + 10);
        } else {
            if (labelLayoutMode === "wrap") {
                margin.bottom = Math.max(
                    baseMargin.bottom,
                    28 + maxWrapLines * (xAxisSettings.fontSize.value + 4)
                );
            }

            if (labelRotation > 0) {
                const longestLabel = d3.max(data, d => (d.category ? d.category.length : 0)) || 0;
                const estimatedRotatedHeight =
                    (longestLabel * xAxisSettings.fontSize.value * 0.6) *
                    Math.sin(labelRotation * Math.PI / 180);

                margin.bottom = Math.max(
                    margin.bottom,
                    20 + estimatedRotatedHeight
                );
            }
        }

        const width = Math.max(viewport.width - margin.left - margin.right, 10);
        const height = Math.max(viewport.height - margin.top - margin.bottom, 10);

        const g = this.mainGroup
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const formatVal = (v: number) => v.toFixed(1);
        const getColor = (_category: string) => color;

        const applySelectionStyles = (
            boxGroup: d3.Selection<SVGGElement, BoxplotDataPoint, SVGGElement, unknown>,
            selectionIds?: ISelectionId[]
        ) => {
            boxGroup
                .classed("selected", dpItem => !!selectionIds && selectionIds.indexOf(dpItem.identity) !== -1)
                .style("opacity", dpItem => {
                    if (!selectionIds || selectionIds.length === 0) {
                        return 1;
                    }
                    return selectionIds.indexOf(dpItem.identity) !== -1 ? 1 : 0.35;
                });
        };

        const attachInteractionHandlers = (
            boxGroup: d3.Selection<SVGGElement, BoxplotDataPoint, SVGGElement, unknown>
        ) => {
            boxGroup
                .attr("tabindex", this.allowInteractions ? 0 : null)
                .attr("role", this.allowInteractions ? "button" : null)
                .on("focus", function () {
                    d3.select(this).classed("keyboard-focus", true);
                })
                .on("blur", function () {
                    d3.select(this).classed("keyboard-focus", false);
                })
                .on("click", (event: MouseEvent, d: BoxplotDataPoint) => {
                    if (!this.allowInteractions) {
                        return;
                    }

                    const isMultiSelect = event.ctrlKey || event.metaKey;
                    this.selectionManager
                        .select(d.identity, isMultiSelect)
                        .then((selectionIds: ISelectionId[] | undefined) => {
                            applySelectionStyles(boxGroup, selectionIds);
                        });

                    event.stopPropagation();
                })
                .on("keydown", (event: KeyboardEvent, d: BoxplotDataPoint) => {
                    if (!this.allowInteractions) {
                        return;
                    }

                    if (event.key === "Enter" || event.key === " ") {
                        const isMultiSelect = event.ctrlKey || event.metaKey;
                        this.selectionManager
                            .select(d.identity, isMultiSelect)
                            .then((selectionIds: ISelectionId[] | undefined) => {
                                applySelectionStyles(boxGroup, selectionIds);
                            });

                        event.preventDefault();
                        event.stopPropagation();
                    }

                    if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
                        this.selectionManager.showContextMenu(d.identity, {
                            x: 0,
                            y: 0
                        });

                        event.preventDefault();
                        event.stopPropagation();
                    }
                });

            this.tooltipServiceWrapper.addTooltip(
                boxGroup,
                (tooltipEvent: BoxplotDataPoint) => [
                    {
                        displayName: this.t("Tooltip_Category", "Category"),
                        value: tooltipEvent.category
                    },
                    {
                        displayName: this.t("Tooltip_Min", "Min"),
                        value: formatVal(tooltipEvent.min)
                    },
                    {
                        displayName: this.t("Tooltip_Q1", "Q1"),
                        value: formatVal(tooltipEvent.q1)
                    },
                    {
                        displayName: this.t("Tooltip_Median", "Median"),
                        value: formatVal(tooltipEvent.median)
                    },
                    {
                        displayName: this.t("Tooltip_Mean", "Mean"),
                        value: formatVal(tooltipEvent.mean)
                    },
                    {
                        displayName: this.t("Tooltip_Q3", "Q3"),
                        value: formatVal(tooltipEvent.q3)
                    },
                    {
                        displayName: this.t("Tooltip_Max", "Max"),
                        value: formatVal(tooltipEvent.max)
                    }
                ],
                (tooltipEvent: BoxplotDataPoint) => tooltipEvent.identity
            );

            this.svg.on("click", () => {
                if (!this.allowInteractions) {
                    return;
                }

                this.selectionManager.clear().then(() => {
                    applySelectionStyles(boxGroup, []);
                });
            });
        };

        if (!isHorizontal) {
            const yScale = d3.scaleLinear()
                .domain([d3.min(allValues)!, d3.max(allValues)!])
                .nice()
                .range([height, 0]);

            const xScale = d3.scaleBand()
                .domain(data.map(d => d.category))
                .range([0, width])
                .padding(0.4);

            const xAxis = d3.axisBottom(xScale)
                .tickSize(xAxisSettings.showTicks.value ? 6 : 0)
                .tickSizeOuter(0);

            const yAxis = d3.axisLeft(yScale)
                .ticks(5)
                .tickSize(yAxisSettings.showTicks.value ? 6 : 0)
                .tickSizeOuter(0);

            const yGrid = d3.axisLeft(yScale)
                .tickSize(-width)
                .tickFormat(() => "");

            const xGrid = d3.axisBottom(xScale)
                .tickSize(-height)
                .tickFormat(() => "");

            if (yAxisSettings.showGrid.value) {
                g.append("g")
                    .attr("class", "grid grid-y")
                    .call(yGrid);
            }

            if (xAxisSettings.showGrid.value) {
                g.append("g")
                    .attr("class", "grid grid-x")
                    .attr("transform", `translate(0,${height})`)
                    .call(xGrid);
            }

            if (xAxisSettings.show.value) {
                const xAxisGroup = g.append("g")
                    .attr("transform", `translate(0,${height})`)
                    .call(xAxis);

                if (!xAxisSettings.showTicks.value) {
                    xAxisGroup.selectAll(".tick line").remove();
                }

                const xAxisTexts = xAxisGroup.selectAll<SVGTextElement, string>("text")
                    .style("font-size", `${xAxisSettings.fontSize.value}px`)
                    .style("fill", this.isHighContrast ? this.foregroundColor : xAxisSettings.fontColor.value.value)
                    .style("font-family", xAxisSettings.fontFamily.value);

                if (labelRotation > 0) {
                    xAxisTexts
                        .style("text-anchor", "end")
                        .attr("dx", "-0.8em")
                        .attr("dy", "0.15em")
                        .attr("transform", `rotate(-${labelRotation})`);
                } else {
                    xAxisTexts
                        .style("text-anchor", "middle")
                        .attr("dx", "0")
                        .attr("dy", "0.71em")
                        .attr("transform", null);
                }

                const availableLabelWidth = Math.max(xScale.bandwidth() * 0.9, 8);

                if (labelRotation === 0 && labelLayoutMode === "truncate") {
                    xAxisGroup
                        .selectAll<SVGTextElement, string>(".tick text")
                        .each(function (d) {
                            truncateAxisLabel(d3.select(this), String(d), availableLabelWidth);
                        });
                }

                if (labelRotation === 0 && labelLayoutMode === "wrap") {
                    xAxisGroup
                        .selectAll<SVGTextElement, string>(".tick text")
                        .each(function (d) {
                            wrapAxisLabel(
                                d3.select(this),
                                String(d),
                                availableLabelWidth,
                                maxWrapLines
                            );
                        });
                }
            }

            if (yAxisSettings.show.value) {
                const yAxisGroup = g.append("g")
                    .call(yAxis);

                if (!yAxisSettings.showTicks.value) {
                    yAxisGroup.selectAll(".tick line").remove();
                }

                yAxisGroup.selectAll("text")
                    .style("font-size", `${yAxisSettings.fontSize.value}px`)
                    .style("fill", this.isHighContrast ? this.foregroundColor : yAxisSettings.fontColor.value.value)
                    .style("font-family", yAxisSettings.fontFamily.value);
            }

            const boxGroup = g.selectAll<SVGGElement, BoxplotDataPoint>(".boxplotBox")
                .data(data)
                .enter()
                .append("g")
                .classed("boxplotBox", true)
                .attr("transform", d => `translate(${xScale(d.category)! + xScale.bandwidth() / 2},0)`);

            const boxWidth = Math.max(xScale.bandwidth() * 0.6, 10);

            boxGroup.append("line")
                .attr("class", "whisker-line")
                .attr("x1", 0)
                .attr("x2", 0)
                .attr("y1", d => yScale(d.min))
                .attr("y2", d => yScale(d.max))
                .attr("stroke", d => getColor(d.category))
                .attr("stroke-width", 1.5);

            boxGroup.append("rect")
                .attr("class", "box-rect")
                .attr("x", -boxWidth / 2)
                .attr("width", boxWidth)
                .attr("y", d => yScale(d.q3))
                .attr("height", d => Math.max(yScale(d.q1) - yScale(d.q3), 1))
                .attr("stroke", d => getColor(d.category))
                .attr("stroke-width", 1.5)
                .attr("fill", this.isHighContrast ? this.backgroundColor : d => getColor(d.category));

            if (shapesSettings.showMedian.value) {
                boxGroup.append("line")
                    .attr("class", "median-line")
                    .attr("x1", -boxWidth / 2)
                    .attr("x2", boxWidth / 2)
                    .attr("y1", d => yScale(d.median))
                    .attr("y2", d => yScale(d.median))
                    .attr("stroke", medianColor)
                    .attr("stroke-width", 2);
            }

            if (shapesSettings.showMean.value) {
                boxGroup.append("circle")
                    .attr("class", "mean-dot")
                    .attr("cx", 0)
                    .attr("cy", d => yScale(d.mean))
                    .attr("r", 4)
                    .attr("fill", meanColor)
                    .attr("stroke", this.isHighContrast ? this.foregroundColor : "#ffffff")
                    .attr("stroke-width", 1);
            }

            boxGroup.append("line")
                .attr("class", "whisker-cap-min")
                .attr("x1", -boxWidth / 4)
                .attr("x2", boxWidth / 4)
                .attr("y1", d => yScale(d.min))
                .attr("y2", d => yScale(d.min))
                .attr("stroke", d => getColor(d.category))
                .attr("stroke-width", 1.5);

            boxGroup.append("line")
                .attr("class", "whisker-cap-max")
                .attr("x1", -boxWidth / 4)
                .attr("x2", boxWidth / 4)
                .attr("y1", d => yScale(d.max))
                .attr("y2", d => yScale(d.max))
                .attr("stroke", d => getColor(d.category))
                .attr("stroke-width", 1.5);

            attachInteractionHandlers(boxGroup);
        } else {
            const xScale = d3.scaleLinear()
                .domain([d3.min(allValues)!, d3.max(allValues)!])
                .nice()
                .range([0, width]);

            const yScale = d3.scaleBand()
                .domain(data.map(d => d.category))
                .range([height, 0])
                .padding(0.4);

            const xAxis = d3.axisBottom(xScale)
                .ticks(5)
                .tickSize(xAxisSettings.showTicks.value ? 6 : 0)
                .tickSizeOuter(0);

            const yAxis = d3.axisLeft(yScale)
                .tickSize(yAxisSettings.showTicks.value ? 6 : 0)
                .tickSizeOuter(0);

            const xGrid = d3.axisBottom(xScale)
                .tickSize(-height)
                .tickFormat(() => "");

            const yGrid = d3.axisLeft(yScale)
                .tickSize(-width)
                .tickFormat(() => "");

            if (yAxisSettings.showGrid.value) {
                g.append("g")
                    .attr("class", "grid grid-y")
                    .call(yGrid);
            }

            if (xAxisSettings.showGrid.value) {
                g.append("g")
                    .attr("class", "grid grid-x")
                    .attr("transform", `translate(0,${height})`)
                    .call(xGrid);
            }

            if (xAxisSettings.show.value) {
                const xAxisGroup = g.append("g")
                    .attr("transform", `translate(0,${height})`)
                    .call(xAxis);

                if (!xAxisSettings.showTicks.value) {
                    xAxisGroup.selectAll(".tick line").remove();
                }

                xAxisGroup.selectAll("text")
                    .style("font-size", `${xAxisSettings.fontSize.value}px`)
                    .style("fill", this.isHighContrast ? this.foregroundColor : xAxisSettings.fontColor.value.value)
                    .style("font-family", xAxisSettings.fontFamily.value);
            }

            if (yAxisSettings.show.value) {
                const yAxisGroup = g.append("g")
                    .call(yAxis);

                if (!yAxisSettings.showTicks.value) {
                    yAxisGroup.selectAll(".tick line").remove();
                }

                yAxisGroup.selectAll("text")
                    .style("font-size", `${yAxisSettings.fontSize.value}px`)
                    .style("fill", this.isHighContrast ? this.foregroundColor : yAxisSettings.fontColor.value.value)
                    .style("font-family", yAxisSettings.fontFamily.value);
            }

            const boxGroup = g.selectAll<SVGGElement, BoxplotDataPoint>(".boxplotBox")
                .data(data)
                .enter()
                .append("g")
                .classed("boxplotBox", true)
                .attr("transform", d => {
                    const yCenter = yScale(d.category)! + yScale.bandwidth() / 2;
                    return `translate(0,${yCenter})`;
                });

            const boxHeight = Math.max(yScale.bandwidth() * 0.6, 10);

            boxGroup.append("line")
                .attr("class", "whisker-line")
                .attr("x1", d => xScale(d.min))
                .attr("x2", d => xScale(d.max))
                .attr("y1", 0)
                .attr("y2", 0)
                .attr("stroke", d => getColor(d.category))
                .attr("stroke-width", 1.5);

            boxGroup.append("rect")
                .attr("class", "box-rect")
                .attr("x", d => xScale(d.q1))
                .attr("width", d => Math.max(xScale(d.q3) - xScale(d.q1), 1))
                .attr("y", -boxHeight / 2)
                .attr("height", boxHeight)
                .attr("stroke", d => getColor(d.category))
                .attr("stroke-width", 1.5)
                .attr("fill", this.isHighContrast ? this.backgroundColor : d => getColor(d.category));

            if (shapesSettings.showMedian.value) {
                boxGroup.append("line")
                    .attr("class", "median-line")
                    .attr("x1", d => xScale(d.median))
                    .attr("x2", d => xScale(d.median))
                    .attr("y1", -boxHeight / 2)
                    .attr("y2", boxHeight / 2)
                    .attr("stroke", medianColor)
                    .attr("stroke-width", 2);
            }

            if (shapesSettings.showMean.value) {
                boxGroup.append("circle")
                    .attr("class", "mean-dot")
                    .attr("cx", d => xScale(d.mean))
                    .attr("cy", 0)
                    .attr("r", 4)
                    .attr("fill", meanColor)
                    .attr("stroke", this.isHighContrast ? this.foregroundColor : "#ffffff")
                    .attr("stroke-width", 1);
            }

            boxGroup.append("line")
                .attr("class", "whisker-cap-min")
                .attr("x1", d => xScale(d.min))
                .attr("x2", d => xScale(d.min))
                .attr("y1", -boxHeight / 4)
                .attr("y2", boxHeight / 4)
                .attr("stroke", d => getColor(d.category))
                .attr("stroke-width", 1.5);

            boxGroup.append("line")
                .attr("class", "whisker-cap-max")
                .attr("x1", d => xScale(d.max))
                .attr("x2", d => xScale(d.max))
                .attr("y1", -boxHeight / 4)
                .attr("y2", boxHeight / 4)
                .attr("stroke", d => getColor(d.category))
                .attr("stroke-width", 1.5);

            attachInteractionHandlers(boxGroup);
        }
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

function quantile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) {
        return NaN;
    }

    const pos = (sortedValues.length - 1) * p;
    const base = Math.floor(pos);
    const rest = pos - base;

    if (sortedValues[base + 1] !== undefined) {
        return sortedValues[base] + rest * (sortedValues[base + 1] - sortedValues[base]);
    }

    return sortedValues[base];
}

function truncateAxisLabel(
    textSelection: d3.Selection<SVGTextElement, string, any, any>,
    originalText: string,
    maxWidth: number
): void {
    textSelection.text(originalText);

    const textNode = textSelection.node();
    if (!textNode) {
        return;
    }

    if (textNode.getComputedTextLength() <= maxWidth) {
        return;
    }

    let truncated = originalText;
    textSelection.text(truncated + "...");

    while (truncated.length > 0 && textNode.getComputedTextLength() > maxWidth) {
        truncated = truncated.slice(0, -1).trimEnd();
        textSelection.text(truncated + "...");
    }

    if (truncated.length === 0) {
        textSelection.text("...");
    }
}

function wrapAxisLabel(
    textSelection: d3.Selection<SVGTextElement, string, any, any>,
    originalText: string,
    _maxWidth: number,
    maxLines: number
): void {
    const words = originalText.split(/\s+/).filter(Boolean);

    if (words.length === 0) {
        textSelection.text(originalText);
        return;
    }

    const x = textSelection.attr("x") || "0";
    const y = textSelection.attr("y") || "0";
    const dy = parseFloat(textSelection.attr("dy") || "0");
    const lineHeightEm = 1.1;

    textSelection
        .text("")
        .attr("text-anchor", "middle");

    const linesToRender = Math.max(1, maxLines);
    const visibleWords = words.slice(0, linesToRender);

    visibleWords.forEach((word, index) => {
        const isLastVisibleLine = index === visibleWords.length - 1;
        const hasMoreWords = words.length > linesToRender;
        const lineText = isLastVisibleLine && hasMoreWords ? `${word}...` : word;

        textSelection
            .append("tspan")
            .attr("x", x)
            .attr("y", y)
            .attr("dy", `${dy + index * lineHeightEm}em`)
            .text(lineText);
    });
}
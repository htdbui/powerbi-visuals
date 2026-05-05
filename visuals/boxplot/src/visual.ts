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

type Selection<T> = d3.Selection<d3.BaseType, T, SVGElement | null, any>;

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
    private svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, any>;
    private mainGroup: d3.Selection<SVGGElement, unknown, HTMLElement, any>;
    private tooltipServiceWrapper: ITooltipServiceWrapper;
    private selectionManager: ISelectionManager;
    private events: IVisualEventService;

    private formattingSettings: VisualFormattingSettingsModel;
    private settings: Settings;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;
        this.events = options.host.eventService;

        this.svg = d3
            .select(options.element)
            .append("svg")
            .classed("boxplotVisual", true);

        this.mainGroup = this.svg.append("g")
            .classed("boxplotMainGroup", true);

        this.tooltipServiceWrapper = createTooltipServiceWrapper(
            this.host.tooltipService,
            options.element
        );

        this.selectionManager = this.host.createSelectionManager();

        this.formattingSettings = new VisualFormattingSettingsModel();
        this.settings = Settings.getDefault();
    }

    public update(options: VisualUpdateOptions): void {
        this.events.renderingStarted(options);

        try {
            const dataView = options.dataViews && options.dataViews[0];

            if (!dataView ||
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

            const min    = values[0];
            const max    = values[values.length - 1];
            const q1     = quantile(values, 0.25);
            const median = quantile(values, 0.5);
            const q3     = quantile(values, 0.75);
            const mean   = values.reduce((a, b) => a + b, 0) / values.length;

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

        const dp                  = this.formattingSettings.dataPointCard;
        const xAxisSettings       = this.formattingSettings.xAxisCard;
        const yAxisSettings       = this.formattingSettings.yAxisCard;
        const shapesSettings      = this.formattingSettings.shapesCard;
        const chartOptionsSettings = this.formattingSettings.chartOptionsCard;

        // Colors
        const color       = dp.fill.value.value;
        const medianColor = dp.medianColor.value.value;
        const meanColor   = dp.meanColor.value.value;

        // Orientation
        let orientation = "vertical";
        if (chartOptionsSettings &&
            chartOptionsSettings.orientation &&
            chartOptionsSettings.orientation.value) {

            const orientationVal = chartOptionsSettings.orientation.value;
            if (typeof orientationVal === "object" && orientationVal !== null) {
                orientation = (orientationVal as any).value as string;
            } else {
                orientation = String(orientationVal);
            }
        }

        const isHorizontal = orientation === "horizontal";

        // Sort by median
        let sortByMedian = false;
        if (chartOptionsSettings &&
            chartOptionsSettings.sortByMedian &&
            chartOptionsSettings.sortByMedian.value !== undefined) {
            sortByMedian = chartOptionsSettings.sortByMedian.value;
        }
        if (sortByMedian) {
            data.sort((a, b) => a.median - b.median);
        }

        // Margins
        const baseMargin = { top: 20, right: 20, bottom: 40, left: 50 };
        const margin = { ...baseMargin };

        if (isHorizontal) {
            const fontSize = yAxisSettings.fontSize.value || 11;
            const maxLabelLen = d3.max(data, d => (d.category ? d.category.length : 0)) || 0;
            const approxLabelWidth = maxLabelLen * fontSize * 0.6;
            margin.left = Math.max(baseMargin.left, approxLabelWidth + 10);
        }

        const width  = Math.max(viewport.width  - margin.left - margin.right,  10);
        const height = Math.max(viewport.height - margin.top  - margin.bottom, 10);

        const g = this.mainGroup
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const formatVal = (v: number) => v.toFixed(1);

        // Color scale for multi-color mode
        const getColor = (_category: string) => color;

        if (!isHorizontal) {
            // ----------------------
            // Vertical orientation
            // ----------------------

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
            const yAxis = d3.axisLeft(yScale).ticks(5)
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

            // ---- X-Achse (vertikal) ----
            if (xAxisSettings.show.value) {
                const xAxisGroup = g.append("g")
                    .attr("transform", `translate(0,${height})`)
                    .call(xAxis);

                if (!xAxisSettings.showTicks.value) {
                    xAxisGroup.selectAll(".tick line").remove();
                }

                xAxisGroup.selectAll("text")
                    .style("font-size",   `${xAxisSettings.fontSize.value}px`)
                    .style("fill",        xAxisSettings.fontColor.value.value)
                    .style("font-family", xAxisSettings.fontFamily.value);
            }

            if (yAxisSettings.show.value) {
                const yAxisGroup = g.append("g")
                    .call(yAxis);

                if (!yAxisSettings.showTicks.value) {
                    yAxisGroup.selectAll(".tick line").remove();
                }

                yAxisGroup.selectAll("text")
                    .style("font-size",   `${yAxisSettings.fontSize.value}px`)
                    .style("fill",        yAxisSettings.fontColor.value.value)
                    .style("font-family", yAxisSettings.fontFamily.value);
            }

            const boxGroup = g.selectAll<SVGGElement, BoxplotDataPoint>(".boxplotBox")
                .data(data)
                .enter()
                .append("g")
                .classed("boxplotBox", true)
                .attr("transform", d =>
                    `translate(${xScale(d.category)! + xScale.bandwidth() / 2},0)`
                );

            const boxWidth = Math.max(xScale.bandwidth() * 0.6, 10);

            // Whisker line
            boxGroup.append("line")
                .attr("class", "whisker-line")
                .attr("x1", 0).attr("x2", 0)
                .attr("y1", d => yScale(d.min))
                .attr("y2", d => yScale(d.max))
                .attr("stroke", d => getColor(d.category))
                .attr("stroke-width", 1.5);

            // Box Q1 to Q3
            boxGroup.append("rect")
                .attr("class", "box-rect")
                .attr("x", -boxWidth / 2)
                .attr("width", boxWidth)
                .attr("y", d => yScale(d.q3))
                .attr("height", d => Math.max(yScale(d.q1) - yScale(d.q3), 1))
                .attr("stroke", d => getColor(d.category))
                .attr("stroke-width", 1.5)
                .attr("fill", d => getColor(d.category));

            // Median line
            if (shapesSettings.showMedian.value) {
                boxGroup.append("line")
                    .attr("class", "median-line")
                    .attr("x1", -boxWidth / 2).attr("x2", boxWidth / 2)
                    .attr("y1", d => yScale(d.median))
                    .attr("y2", d => yScale(d.median))
                    .attr("stroke", medianColor)
                    .attr("stroke-width", 2);
            }

            // Mean dot
            if (shapesSettings.showMean.value) {
                boxGroup.append("circle")
                    .attr("class", "mean-dot")
                    .attr("cx", 0)
                    .attr("cy", d => yScale(d.mean))
                    .attr("r", 4)
                    .attr("fill", meanColor)
                    .attr("stroke", "#ffffff")
                    .attr("stroke-width", 1);
            }

            // Whisker caps
            boxGroup.append("line")
                .attr("class", "whisker-cap-min")
                .attr("x1", -boxWidth / 4).attr("x2", boxWidth / 4)
                .attr("y1", d => yScale(d.min))
                .attr("y2", d => yScale(d.min))
                .attr("stroke", d => getColor(d.category))
                .attr("stroke-width", 1.5);

            boxGroup.append("line")
                .attr("class", "whisker-cap-max")
                .attr("x1", -boxWidth / 4).attr("x2", boxWidth / 4)
                .attr("y1", d => yScale(d.max))
                .attr("y2", d => yScale(d.max))
                .attr("stroke", d => getColor(d.category))
                .attr("stroke-width", 1.5);

            // Selection
            boxGroup.on("click", (event: MouseEvent, d: BoxplotDataPoint) => {
                const isMultiSelect = event.ctrlKey || event.metaKey;
                this.selectionManager
                    .select(d.identity, isMultiSelect)
                    .then((selectionIds: ISelectionId[] | undefined) => {
                        boxGroup.classed("selected", dp =>
                            !!selectionIds && selectionIds.indexOf(dp.identity) !== -1
                        );
                    });
                event.stopPropagation();
            });

            this.svg.on("click", () => {
                this.selectionManager.clear().then(() => {
                    boxGroup.classed("selected", false);
                });
            });

            // Tooltips
            this.tooltipServiceWrapper.addTooltip(
                boxGroup,
                (tooltipEvent: BoxplotDataPoint) => [
                    { displayName: "Category", value: tooltipEvent.category },
                    { displayName: "Min",      value: formatVal(tooltipEvent.min) },
                    { displayName: "Q1",       value: formatVal(tooltipEvent.q1) },
                    { displayName: "Median",   value: formatVal(tooltipEvent.median) },
                    { displayName: "Mean",     value: formatVal(tooltipEvent.mean) },
                    { displayName: "Q3",       value: formatVal(tooltipEvent.q3) },
                    { displayName: "Max",      value: formatVal(tooltipEvent.max) }
                ],
                (tooltipEvent: BoxplotDataPoint) => tooltipEvent.identity
            );

        } else {
            // ----------------------
            // Horizontal orientation
            // ----------------------
            const xScale = d3.scaleLinear()
                .domain([d3.min(allValues)!, d3.max(allValues)!])
                .nice()
                .range([0, width]);

            const yScale = d3.scaleBand()
                .domain(data.map(d => d.category))
                .range([height, 0])
                .padding(0.4);

            const xAxis = d3.axisBottom(xScale).ticks(5)
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
                    .style("font-size",   `${xAxisSettings.fontSize.value}px`)
                    .style("fill",        xAxisSettings.fontColor.value.value)
                    .style("font-family", xAxisSettings.fontFamily.value);
            }

            if (yAxisSettings.show.value) {
                const yAxisGroup = g.append("g")
                    .call(yAxis);

                if (!yAxisSettings.showTicks.value) {
                    yAxisGroup.selectAll(".tick line").remove();
                }

                yAxisGroup.selectAll("text")
                    .style("font-size",   `${yAxisSettings.fontSize.value}px`)
                    .style("fill",        yAxisSettings.fontColor.value.value)
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

            // Whisker line
            boxGroup.append("line")
                .attr("class", "whisker-line")
                .attr("x1", d => xScale(d.min))
                .attr("x2", d => xScale(d.max))
                .attr("y1", 0).attr("y2", 0)
                .attr("stroke", d => getColor(d.category))
                .attr("stroke-width", 1.5);

            // Box Q1 to Q3
            boxGroup.append("rect")
                .attr("class", "box-rect")
                .attr("x", d => xScale(d.q1))
                .attr("width", d => Math.max(xScale(d.q3) - xScale(d.q1), 1))
                .attr("y", -boxHeight / 2)
                .attr("height", boxHeight)
                .attr("stroke", d => getColor(d.category))
                .attr("stroke-width", 1.5)
                .attr("fill", d => getColor(d.category));

            // Median line
            if (shapesSettings.showMedian.value) {
                boxGroup.append("line")
                    .attr("class", "median-line")
                    .attr("x1", d => xScale(d.median))
                    .attr("x2", d => xScale(d.median))
                    .attr("y1", -boxHeight / 2)
                    .attr("y2",  boxHeight / 2)
                    .attr("stroke", medianColor)
                    .attr("stroke-width", 2);
            }

            // Mean dot
            if (shapesSettings.showMean.value) {
                boxGroup.append("circle")
                    .attr("class", "mean-dot")
                    .attr("cx", d => xScale(d.mean))
                    .attr("cy", 0)
                    .attr("r", 4)
                    .attr("fill", meanColor)
                    .attr("stroke", "#ffffff")
                    .attr("stroke-width", 1);
            }

            // Whisker caps
            boxGroup.append("line")
                .attr("class", "whisker-cap-min")
                .attr("x1", d => xScale(d.min))
                .attr("x2", d => xScale(d.min))
                .attr("y1", -boxHeight / 4)
                .attr("y2",  boxHeight / 4)
                .attr("stroke", d => getColor(d.category))
                .attr("stroke-width", 1.5);

            boxGroup.append("line")
                .attr("class", "whisker-cap-max")
                .attr("x1", d => xScale(d.max))
                .attr("x2", d => xScale(d.max))
                .attr("y1", -boxHeight / 4)
                .attr("y2",  boxHeight / 4)
                .attr("stroke", d => getColor(d.category))
                .attr("stroke-width", 1.5);

            // Selection
            boxGroup.on("click", (event: MouseEvent, d: BoxplotDataPoint) => {
                const isMultiSelect = event.ctrlKey || event.metaKey;
                this.selectionManager
                    .select(d.identity, isMultiSelect)
                    .then((selectionIds: ISelectionId[] | undefined) => {
                        boxGroup.classed("selected", dp =>
                            !!selectionIds && selectionIds.indexOf(dp.identity) !== -1
                        );
                    });
                event.stopPropagation();
            });

            this.svg.on("click", () => {
                this.selectionManager.clear().then(() => {
                    boxGroup.classed("selected", false);
                });
            });

            // Tooltips
            this.tooltipServiceWrapper.addTooltip(
                boxGroup,
                (tooltipEvent: BoxplotDataPoint) => [
                    { displayName: "Category", value: tooltipEvent.category },
                    { displayName: "Min",      value: formatVal(tooltipEvent.min) },
                    { displayName: "Q1",       value: formatVal(tooltipEvent.q1) },
                    { displayName: "Median",   value: formatVal(tooltipEvent.median) },
                    { displayName: "Mean",     value: formatVal(tooltipEvent.mean) },
                    { displayName: "Q3",       value: formatVal(tooltipEvent.q3) },
                    { displayName: "Max",      value: formatVal(tooltipEvent.max) }
                ],
                (tooltipEvent: BoxplotDataPoint) => tooltipEvent.identity
            );
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
    const pos  = (sortedValues.length - 1) * p;
    const base = Math.floor(pos);
    const rest = pos - base;

    if (sortedValues[base + 1] !== undefined) {
        return sortedValues[base] + rest * (sortedValues[base + 1] - sortedValues[base]);
    } else {
        return sortedValues[base];
    }
}

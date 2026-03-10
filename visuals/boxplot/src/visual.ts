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
import DataViewValueColumnGroup = powerbi.DataViewValueColumnGroup;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstanceEnumeration = powerbi.VisualObjectInstanceEnumeration;
import FormattingModel = powerbi.visuals.FormattingModel;
import ISelectionManager = powerbi.extensibility.ISelectionManager;

type Selection<T> = d3.Selection<d3.BaseType, T, SVGElement | null, any>;

interface BoxplotDataPoint {
    category: string;
    min: number;
    q1: number;
    median: number;
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

    private formattingSettings: VisualFormattingSettingsModel;
    private settings: Settings;

    constructor(options: VisualConstructorOptions) {
        this.host = options.host;

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
        const dataView = options.dataViews && options.dataViews[0];

        if (!dataView ||
            !dataView.categorical ||
            !dataView.categorical.categories ||
            dataView.categorical.categories.length === 0 ||
            !dataView.categorical.values ||
            dataView.categorical.values.length === 0
        ) {
            this.clear();
            return;
        }

        // Legacy settings (for backward-compat enumeration)
        this.settings = Settings.parse<Settings>(dataView);

        // Modern formatting settings (formatting model)
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
        this.mainGroup.selectAll("*").remove();
    }

    private transform(dataView: DataView): BoxplotViewModel {
        const categorical = dataView.categorical;
        const categoryColumn: DataViewCategoryColumn = categorical.categories![0];
        const valueColumns: DataViewValueColumns = categorical.values!;
        const valueGroups: DataViewValueColumnGroup[] = valueColumns.grouped();

        const categories = categoryColumn.values.map(c => String(c));

        // group values by category
        const grouped: { [category: string]: number[] } = {};

        categories.forEach((cat, idx) => {
            const categoryName = String(cat);
            const valuesForCategory: number[] = [];

            // iterate through all value groups and all measures
            valueGroups.forEach(group => {
                group.values.forEach(vcol => {
                    const value = vcol.values[idx] as number;
                    if (value != null && !isNaN(value)) {
                        valuesForCategory.push(value);
                    }
                });
            });

            grouped[categoryName] = valuesForCategory;
        });

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
        const data = viewModel.dataPoints;
        this.mainGroup.selectAll("*").remove();

        if (data.length === 0) {
            return;
        }

        const margin = { top: 20, right: 20, bottom: 40, left: 50 };
        const width = Math.max(viewport.width - margin.left - margin.right, 10);
        const height = Math.max(viewport.height - margin.top - margin.bottom, 10);

        const g = this.mainGroup
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const allValues = data.reduce(
            (acc, d) => acc.concat([d.min, d.max]),
            [] as number[]
        );

        const yScale = d3.scaleLinear()
            .domain([d3.min(allValues)!, d3.max(allValues)!])
            .nice()
            .range([height, 0]);

        const xScale = d3.scaleBand()
            .domain(data.map(d => d.category))
            .range([0, width])
            .padding(0.4);

        // colors from formatting model
        const dp = this.formattingSettings.dataPointCard;
        const color = dp.oneColor.value
            ? dp.oneFill.value.value
            : dp.fill.value.value;
        const medianColor = dp.medianColor.value.value;

        const xAxisSettings = this.formattingSettings.xAxisCard;
        const yAxisSettings = this.formattingSettings.yAxisCard;
        const shapesSettings = this.formattingSettings.shapesCard;

        // Axes
        const xAxis = d3.axisBottom(xScale);
        const yAxis = d3.axisLeft(yScale).ticks(5);

        if (xAxisSettings.show.value) {
            g.append("g")
                .attr("transform", `translate(0,${height})`)
                .call(xAxis)
                .selectAll("text")
                .style("font-size", `${xAxisSettings.fontSize.value}px`)
                .style("fill", xAxisSettings.fontColor.value.value)
                .style("font-family", xAxisSettings.fontFamily.value);
        }

        if (yAxisSettings.show.value) {
            g.append("g")
                .call(yAxis)
                .selectAll("text")
                .style("font-size", `${yAxisSettings.fontSize.value}px`)
                .style("fill", yAxisSettings.fontColor.value.value)
                .style("font-family", yAxisSettings.fontFamily.value);
        }

        // Draw boxes
        const boxGroup = g.selectAll<SVGGElement, BoxplotDataPoint>(".boxplotBox")
            .data(data)
            .enter()
            .append("g")
            .classed("boxplotBox", true)
            .attr("transform", d => `translate(${xScale(d.category)! + xScale.bandwidth() / 2},0)`);

        const boxWidth = Math.max(xScale.bandwidth() * 0.6, 10);

        // Vertical line (whisker from min to max)
        boxGroup.append("line")
            .attr("class", "whisker-line")
            .attr("x1", 0)
            .attr("x2", 0)
            .attr("y1", d => yScale(d.min))
            .attr("y2", d => yScale(d.max))
            .attr("stroke", color)
            .attr("stroke-width", 1.5);

        // Box from Q1 to Q3
        boxGroup.append("rect")
            .attr("class", "box-rect")
            .attr("x", -boxWidth / 2)
            .attr("width", boxWidth)
            .attr("y", d => yScale(d.q3))
            .attr("height", d => Math.max(yScale(d.q1) - yScale(d.q3), 1))
            .attr("stroke", color)
            .attr("stroke-width", 1.5)
            .attr("fill", color);

        // Median line
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

        // Whisker caps (horizontal lines at min & max)
        boxGroup.append("line")
            .attr("class", "whisker-cap-min")
            .attr("x1", -boxWidth / 4)
            .attr("x2", boxWidth / 4)
            .attr("y1", d => yScale(d.min))
            .attr("y2", d => yScale(d.min))
            .attr("stroke", color)
            .attr("stroke-width", 1.5);

        boxGroup.append("line")
            .attr("class", "whisker-cap-max")
            .attr("x1", -boxWidth / 4)
            .attr("x2", boxWidth / 4)
            .attr("y1", d => yScale(d.max))
            .attr("y2", d => yScale(d.max))
            .attr("stroke", color)
            .attr("stroke-width", 1.5);

        // Selection behavior
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

        // Clear selection when clicking background
        this.svg.on("click", () => {
            this.selectionManager.clear().then(() => {
                boxGroup.classed("selected", false);
            });
        });

        // Tooltips
        this.tooltipServiceWrapper.addTooltip(
            boxGroup,
            (d: BoxplotDataPoint) => [{
                displayName: d.category,
                value: `min: ${d.min}
Q1: ${d.q1}
median: ${d.median}
Q3: ${d.q3}
max: ${d.max}`
            }],
            (d: BoxplotDataPoint) => d.identity
        );
    }

    public enumerateObjectInstances(
        options: EnumerateVisualObjectInstancesOptions
    ): VisualObjectInstanceEnumeration {
        // Use legacy Settings for older format pane enumeration
        return Settings.enumerateObjectInstances(
            this.settings || Settings.getDefault(),
            options
        );
    }

    public getFormattingModel(): FormattingModel {
        // Modern format pane
        return formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }
}

/**
 * Simple quantile function (p between 0 and 1)
 */
function quantile(sortedValues: number[], p: number): number {
    if (sortedValues.length === 0) {
        return NaN;
    }
    const pos = (sortedValues.length - 1) * p;
    const base = Math.floor(pos);
    const rest = pos - base;

    if (sortedValues[base + 1] !== undefined) {
        return sortedValues[base] + rest * (sortedValues[base + 1] - sortedValues[base]);
    } else {
        return sortedValues[base];
    }
}
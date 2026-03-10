import { dataViewObjectsParser } from "powerbi-visuals-utils-dataviewutils";
import DataViewObjectsParser = dataViewObjectsParser.DataViewObjectsParser;
export declare class Settings extends DataViewObjectsParser {
    static getDefault(): Settings;
    general: {
        telemetry: boolean;
    };
    chartOptions: {
        orientation: number;
        quartile: number;
        whisker: number;
        lower: number | undefined;
        higher: number | undefined;
        outliers: boolean;
        margin: number;
    };
    xAxis: {
        show: boolean;
        fontColor: string;
        fontSize: number;
        fontFamily: string;
        labelDisplayUnits: number;
        labelPrecision: number | undefined;
        orientation: number;
        showTitle: boolean;
        title: string;
        titleFontColor: string;
        titleFontSize: number;
        titleFontFamily: string;
        titleAlignment: number;
    };
    yAxis: {
        show: boolean;
        start: number | undefined;
        end: number | undefined;
        fontColor: string;
        fontSize: number;
        fontFamily: string;
        labelDisplayUnits: number;
        labelPrecision: number | undefined;
        showTitle: boolean;
        title: string;
        titleFontColor: string;
        titleFontSize: number;
        titleFontFamily: string;
        titleAlignment: number;
    };
    dataPoint: {
        meanColor: string;
        medianColor: string;
        oneColor: boolean;
        oneFill: string;
        fill: string;
    };
    labels: {
        show: boolean;
        fontColor: string;
        fontSize: number;
        fontFamily: string;
        labelDisplayUnits: number;
        labelPrecision: number | undefined;
    };
    shapes: {
        showMean: boolean;
        showMedian: boolean;
        highlight: boolean;
        fixedCategory: boolean;
    };
    gridLines: {
        show: boolean;
        majorGridSize: number;
        majorGridColor: string;
        minorGrid: boolean;
        minorGridSize: number;
        minorGridColor: string;
    };
    y1AxisReferenceLine: {
        show: boolean;
        displayName: string;
        value: number | undefined;
        lineColor: string;
        transparency: number;
        style: number;
        position: number;
        showLabel: boolean;
        labelColor: string;
        labelType: number;
        labelFontSize: number;
        labelFontFamily: string;
        labelDisplayUnits: number;
        labelPrecision: number | undefined;
        hPosition: number;
        vPosition: number;
    };
}

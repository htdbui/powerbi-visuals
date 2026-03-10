import { dataViewObjectsParser } from "powerbi-visuals-utils-dataviewutils";
import DataViewObjectsParser = dataViewObjectsParser.DataViewObjectsParser;

export class Settings extends DataViewObjectsParser {
    public static getDefault(): Settings {
        return new Settings();
    }

    public general = {
        telemetry: false as boolean
    };

    public chartOptions = {
        orientation: 0 as number,
        quartile: 0 as number,
        whisker: 0 as number,
        lower: undefined as number | undefined,
        higher: undefined as number | undefined,
        outliers: true as boolean,
        margin: 0 as number
    };

    public xAxis = {
        show: true as boolean,
        fontColor: "#666666",
        fontSize: 11 as number,
        fontFamily: "Segoe UI",
        labelDisplayUnits: 0 as number,
        labelPrecision: undefined as number | undefined,
        orientation: 0 as number,
        showTitle: false as boolean,
        title: "",
        titleFontColor: "#666666",
        titleFontSize: 11 as number,
        titleFontFamily: "Segoe UI",
        titleAlignment: 0 as number
    };

    public yAxis = {
        show: true as boolean,
        start: undefined as number | undefined,
        end: undefined as number | undefined,
        fontColor: "#666666",
        fontSize: 11 as number,
        fontFamily: "Segoe UI",
        labelDisplayUnits: 0 as number,
        labelPrecision: undefined as number | undefined,
        showTitle: false as boolean,
        title: "",
        titleFontColor: "#666666",
        titleFontSize: 11 as number,
        titleFontFamily: "Segoe UI",
        titleAlignment: 0 as number
    };

    public dataPoint = {
        meanColor: "#000000",
        medianColor: "#000000",
        oneColor: false as boolean,
        oneFill: "#4c78a8",
        fill: "#4c78a8"
    };

    public labels = {
        show: false as boolean,
        fontColor: "#666666",
        fontSize: 9 as number,
        fontFamily: "Segoe UI",
        labelDisplayUnits: 0 as number,
        labelPrecision: undefined as number | undefined
    };

    public shapes = {
        showMean: false as boolean,
        showMedian: true as boolean,
        highlight: true as boolean,
        fixedCategory: false as boolean
    };

    public gridLines = {
        show: false as boolean,
        majorGridSize: 1 as number,
        majorGridColor: "#e6e6e6",
        minorGrid: false as boolean,
        minorGridSize: 1 as number,
        minorGridColor: "#f0f0f0"
    };

    public y1AxisReferenceLine = {
        show: false as boolean,
        displayName: "",
        value: undefined as number | undefined,
        lineColor: "#000000",
        transparency: 50 as number,
        style: 0 as number,
        position: 1 as number,
        showLabel: false as boolean,
        labelColor: "#000000",
        labelType: 0 as number,
        labelFontSize: 9 as number,
        labelFontFamily: "Segoe UI",
        labelDisplayUnits: 0 as number,
        labelPrecision: undefined as number | undefined,
        hPosition: 0 as number,
        vPosition: 0 as number
    };
}
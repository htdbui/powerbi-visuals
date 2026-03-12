import { dataViewObjectsParser } from "powerbi-visuals-utils-dataviewutils";
import DataViewObjectsParser = dataViewObjectsParser.DataViewObjectsParser;

export class Settings extends DataViewObjectsParser {
    public static getDefault(): Settings {
        return new Settings();
    }

    public colorOptions = {
        colorMode: "rules" as string,
        colorLow: "#ffffff",
        colorHigh: "#1a5276",
        defaultColor: "#d3d3d3"
    };

    public mapOptions = {
        borderColor: "#ffffff",
        borderWidth: 0.3 as number,
        backgroundColor: "#f0f0f0"
    };
}

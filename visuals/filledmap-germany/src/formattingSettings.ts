"use strict";

import {
    formattingSettings,
    FormattingSettingsService
} from "powerbi-visuals-utils-formattingmodel";

// Color options card (mapped to "colorOptions" in capabilities.json)
export class ColorOptionsCardSettings extends formattingSettings.SimpleCard {
    public name: string = "colorOptions";
    public displayName: string = "Color options";

    public colorMode = new formattingSettings.ItemDropdown({
        name: "colorMode",
        displayName: "Color mode",
        items: [
            { value: "rules", displayName: "Rules (min → max scale)" },
            { value: "fixedValue", displayName: "Fixed value (hex column)" },
            { value: "saturation", displayName: "Saturation" }
        ],
        value: { value: "rules", displayName: "Rules (min → max scale)" }
    });

    public colorLow = new formattingSettings.ColorPicker({
        name: "colorLow",
        displayName: "Low value color",
        value: { value: "#ffffff" }
    });

    public colorHigh = new formattingSettings.ColorPicker({
        name: "colorHigh",
        displayName: "High value color",
        value: { value: "#1a5276" }
    });

    public defaultColor = new formattingSettings.ColorPicker({
        name: "defaultColor",
        displayName: "No-data color",
        value: { value: "#d3d3d3" }
    });

    public slices: formattingSettings.Slice[] = [
        this.colorMode,
        this.colorLow,
        this.colorHigh,
        this.defaultColor
    ];
}

// Map options card (mapped to "mapOptions" in capabilities.json)
export class MapOptionsCardSettings extends formattingSettings.SimpleCard {
    public name: string = "mapOptions";
    public displayName: string = "Map options";

    public borderColor = new formattingSettings.ColorPicker({
        name: "borderColor",
        displayName: "Border color",
        value: { value: "#ffffff" }
    });

    public borderWidth = new formattingSettings.NumUpDown({
        name: "borderWidth",
        displayName: "Border width",
        value: 0.3
    });

    public backgroundColor = new formattingSettings.ColorPicker({
        name: "backgroundColor",
        displayName: "Background color",
        value: { value: "#f0f0f0" }
    });

    public slices: formattingSettings.Slice[] = [
        this.borderColor,
        this.borderWidth,
        this.backgroundColor
    ];
}

// Root formatting model queried by Power BI
export class VisualFormattingSettingsModel extends formattingSettings.Model {
    public colorOptionsCard = new ColorOptionsCardSettings();
    public mapOptionsCard = new MapOptionsCardSettings();

    public cards: formattingSettings.SimpleCard[] = [
        this.colorOptionsCard,
        this.mapOptionsCard
    ];
}

// Single shared service instance
export const formattingSettingsService = new FormattingSettingsService();

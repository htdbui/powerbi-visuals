"use strict";

// Modern format pane settings model
// Ensure: npm install powerbi-visuals-utils-formattingmodel --save

import {
    formattingSettings,
    FormattingSettingsService
} from "powerbi-visuals-utils-formattingmodel";

// Data colors (mapped to "dataPoint" object in capabilities.json)
export class DataPointCardSettings extends formattingSettings.SimpleCard {
    public name: string = "dataPoint";
    public displayName: string = "Data colors";

    public oneColor = new formattingSettings.ToggleSwitch({
        name: "oneColor",
        displayName: "Use single color",
        value: false
    });

    public oneFill = new formattingSettings.ColorPicker({
        name: "oneFill",
        displayName: "Box color",
        value: { value: "#4c78a8" }
    });

    public fill = new formattingSettings.ColorPicker({
        name: "fill",
        displayName: "Series color",
        value: { value: "#4c78a8" }
    });

    public medianColor = new formattingSettings.ColorPicker({
        name: "medianColor",
        displayName: "Median color",
        value: { value: "#000000" }
    });

    public slices: formattingSettings.Slice[] = [
        this.oneColor,
        this.oneFill,
        this.fill,
        this.medianColor
    ];
}

// X axis (mapped to "xAxis")
export class XAxisCardSettings extends formattingSettings.SimpleCard {
    public name: string = "xAxis";
    public displayName: string = "X axis";

    public show = new formattingSettings.ToggleSwitch({
        name: "show",
        displayName: "Show",
        value: true
    });

    public fontColor = new formattingSettings.ColorPicker({
        name: "fontColor",
        displayName: "Font color",
        value: { value: "#666666" }
    });

    public fontSize = new formattingSettings.NumUpDown({
        name: "fontSize",
        displayName: "Text size",
        value: 11
    });

    public fontFamily = new formattingSettings.TextInput({
        name: "fontFamily",
        displayName: "Font family",
        value: "Segoe UI",
        placeholder: "Segoe UI"
    });

    public slices: formattingSettings.Slice[] = [
        this.show,
        this.fontColor,
        this.fontSize,
        this.fontFamily
    ];
}

// Y axis (mapped to "yAxis")
export class YAxisCardSettings extends formattingSettings.SimpleCard {
    public name: string = "yAxis";
    public displayName: string = "Y axis";

    public show = new formattingSettings.ToggleSwitch({
        name: "show",
        displayName: "Show",
        value: true
    });

    public fontColor = new formattingSettings.ColorPicker({
        name: "fontColor",
        displayName: "Font color",
        value: { value: "#666666" }
    });

    public fontSize = new formattingSettings.NumUpDown({
        name: "fontSize",
        displayName: "Text size",
        value: 11
    });

    public fontFamily = new formattingSettings.TextInput({
        name: "fontFamily",
        displayName: "Font family",
        value: "Segoe UI",
        placeholder: "Segoe UI"
    });

    public slices: formattingSettings.Slice[] = [
        this.show,
        this.fontColor,
        this.fontSize,
        this.fontFamily
    ];
}

// Shapes settings (mapped to "shapes")
export class ShapesCardSettings extends formattingSettings.SimpleCard {
    public name: string = "shapes";
    public displayName: string = "Shapes";

    public showMedian = new formattingSettings.ToggleSwitch({
        name: "showMedian",
        displayName: "Show median",
        value: true
    });

    public showMean = new formattingSettings.ToggleSwitch({
        name: "showMean",
        displayName: "Show mean",
        value: false
    });

    public highlight = new formattingSettings.ToggleSwitch({
        name: "highlight",
        displayName: "Highlight",
        value: true
    });

    public fixedCategory = new formattingSettings.ToggleSwitch({
        name: "fixedCategory",
        displayName: "Fixed category",
        value: false
    });

    public slices: formattingSettings.Slice[] = [
        this.showMedian,
        this.showMean,
        this.highlight,
        this.fixedCategory
    ];
}

// Root formatting model that Power BI will query
export class VisualFormattingSettingsModel extends formattingSettings.Model {
    public dataPointCard = new DataPointCardSettings();
    public xAxisCard = new XAxisCardSettings();
    public yAxisCard = new YAxisCardSettings();
    public shapesCard = new ShapesCardSettings();

    public cards: formattingSettings.SimpleCard[] = [
        this.dataPointCard,
        this.xAxisCard,
        this.yAxisCard,
        this.shapesCard
    ];
}

// Single instance of the service
export const formattingSettingsService = new FormattingSettingsService();
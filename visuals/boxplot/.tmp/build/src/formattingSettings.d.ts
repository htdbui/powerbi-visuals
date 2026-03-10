import { formattingSettings, FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
export declare class ChartOptionsCardSettings extends formattingSettings.SimpleCard {
    name: string;
    displayName: string;
    orientation: formattingSettings.NumUpDown;
    slices: formattingSettings.Slice[];
}
export declare class DataPointCardSettings extends formattingSettings.SimpleCard {
    name: string;
    displayName: string;
    oneColor: formattingSettings.ToggleSwitch;
    oneFill: formattingSettings.ColorPicker;
    fill: formattingSettings.ColorPicker;
    medianColor: formattingSettings.ColorPicker;
    slices: formattingSettings.Slice[];
}
export declare class XAxisCardSettings extends formattingSettings.SimpleCard {
    name: string;
    displayName: string;
    show: formattingSettings.ToggleSwitch;
    fontColor: formattingSettings.ColorPicker;
    fontSize: formattingSettings.NumUpDown;
    fontFamily: formattingSettings.TextInput;
    slices: formattingSettings.Slice[];
}
export declare class YAxisCardSettings extends formattingSettings.SimpleCard {
    name: string;
    displayName: string;
    show: formattingSettings.ToggleSwitch;
    fontColor: formattingSettings.ColorPicker;
    fontSize: formattingSettings.NumUpDown;
    fontFamily: formattingSettings.TextInput;
    slices: formattingSettings.Slice[];
}
export declare class ShapesCardSettings extends formattingSettings.SimpleCard {
    name: string;
    displayName: string;
    showMedian: formattingSettings.ToggleSwitch;
    showMean: formattingSettings.ToggleSwitch;
    highlight: formattingSettings.ToggleSwitch;
    fixedCategory: formattingSettings.ToggleSwitch;
    slices: formattingSettings.Slice[];
}
export declare class VisualFormattingSettingsModel extends formattingSettings.Model {
    chartOptionsCard: ChartOptionsCardSettings;
    dataPointCard: DataPointCardSettings;
    xAxisCard: XAxisCardSettings;
    yAxisCard: YAxisCardSettings;
    shapesCard: ShapesCardSettings;
    cards: formattingSettings.SimpleCard[];
}
export declare const formattingSettingsService: FormattingSettingsService;

export interface Coordinates {
    x: number;
    y: number;
}

export interface Size {
    width: number;
    height: number;
}

export function makeSize(size: Size) {
    return new Float64Array([size.width, size.height]);
}

export type Frame = Coordinates & Size;

export function makeFrame(frame: Frame) {
    return new Float64Array([frame.x, frame.y, frame.width, frame.height]);
}

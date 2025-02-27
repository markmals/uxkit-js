import { _, id } from "./objc.ts";
import { Frame, makeFrame } from "./positional-types.ts";

export class View extends EventTarget {
    protected pointer: id;

    toPointer(): id {
        return this.pointer;
    }

    public set frame(newValue: Frame) {
        _`${this.pointer} setFrame:${makeFrame(newValue)}`;
    }
}

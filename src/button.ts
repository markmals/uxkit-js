import { makeFrame, Frame } from "./positional-types.ts";
import {
    _,
    createClass,
    NSButton,
    NSObject,
    id,
    NSBezelStyle as ButtonStyle,
    NSAutoresizingMaskOptions as AutoresizingMaskOption,
} from "./objc.ts";
import { View } from "./view.ts";

export class ClickEvent extends Event {
    public readonly sender: id;

    constructor(sender: id) {
        super("click");
        this.sender = sender;
    }
}

export class ButtonView extends View {
    constructor(frame?: Frame) {
        super();

        if (frame) {
            this.pointer = _`${_`${NSButton} alloc`} initWithFrame:${makeFrame(frame)}`;
        } else {
            this.pointer = _`${_`${NSButton} alloc`} init`;
        }

        const ACTION_SEL = "performButtonAction:";

        const { proxy: UXButtonViewActionDelegate } = createClass({
            name: "__UXButtonViewActionDelegate",
            superclass: NSObject,
            methods: [
                {
                    name: ACTION_SEL,
                    parameters: ["id"],
                    result: "void",
                    fn: sender => {
                        this.dispatchEvent(new ClickEvent(sender));
                    },
                },
            ],
        });

        const delegate = _`${_`${UXButtonViewActionDelegate} alloc`} init`;
        _`${this.pointer} setTarget:${delegate}`;
        _`${this.pointer} setAction:${ACTION_SEL}`;
    }

    public override addEventListener(
        type: "click",
        listener:
            | ((event: ClickEvent) => void)
            | {
                  handleEvent(evt: ClickEvent): void;
              }
            | null,
        options?: boolean | AddEventListenerOptions,
    ): void {
        if (type === "click" && listener) {
            // deno-lint-ignore no-explicit-any
            super.addEventListener(type, listener as any, options);
        }
    }

    public override dispatchEvent(event: ClickEvent): boolean {
        return super.dispatchEvent(event);
    }

    public override removeEventListener(
        type: "click",
        listener:
            | ((event: ClickEvent) => void)
            | {
                  handleEvent(evt: ClickEvent): void;
              }
            | null,
        options?: boolean | AddEventListenerOptions | undefined,
    ): void {
        // deno-lint-ignore no-explicit-any
        super.removeEventListener(type, listener as any, options);
    }

    public set textContent(newValue: string) {
        _`${this.pointer} setTitle:${newValue}`;
    }

    public set style(newValue: ButtonStyle) {
        _`${this.pointer} setBezelStyle:${newValue}`;
    }

    public set autoresizingMask(newValue: AutoresizingMaskOption) {
        _`${this.pointer} setAutoresizingMask:${newValue}`;
    }
}

// MARK: Usage Example

const button = new ButtonView();
button.frame = { x: 0, y: 0, width: 200, height: 500 };
button.textContent = "Click Me!";
button.style = ButtonStyle.Push;
button.autoresizingMask = AutoresizingMaskOption.MaxXMargin | AutoresizingMaskOption.MinYMargin;
button.addEventListener("click", event => {
    console.log("Button clicked", event.sender);
});

import objc from "objc";

export type id = (typeof objc.classes)[string];

export const { NSObject, NSButton } = objc.classes;
export const _ = objc.send;
export const createClass = objc.createClass;

/**
 * Button bezel styles for macOS.
 */
export enum NSBezelStyle {
    /**
     * The appearance of this bezel style is automatically determined based on the button's contents and position within the window.
     * This bezel style is the default for all button initializers.
     * Available in macOS 14.0 and later.
     */
    Automatic = 0,

    /**
     * The standard system push button style.
     */
    Push = 1,

    /**
     * A flexible-height variant of NSBezelStyle.Push.
     */
    FlexiblePush = 2,

    /**
     * An unbezeled button with a disclosure triangle.
     */
    Disclosure = 5,

    /**
     * A button with a circular bezel suitable for a small icon or single character.
     */
    Circular = 7,

    /**
     * A circular button with a question mark providing the standard Help button appearance.
     */
    HelpButton = 9,

    /**
     * A button with squared edges and flexible height.
     */
    SmallSquare = 10,

    /**
     * A button style that is appropriate for use in a toolbar item.
     */
    Toolbar = 11,

    /**
     * A bezel style that is suitable for accessory and scope bars.
     * This style is typically used for buttons that perform an action or for pop-up buttons.
     */
    AccessoryBarAction = 12,

    /**
     * A bezel style that is suitable for accessory and scope bars.
     * This style is typically used for buttons with togglable state.
     */
    AccessoryBar = 13,

    /**
     * A bezeled variant of Disclosure.
     */
    PushDisclosure = 14,

    /**
     * A bezel style that is typically used in table rows to display information about the row, such as a count.
     * Available in macOS 10.7 and later.
     */
    Badge = 15,

    /**
     * @deprecated Use SmallSquare instead.
     */
    ShadowlessSquare = NSBezelStyle.SmallSquare,

    /**
     * @deprecated Use SmallSquare instead.
     */
    TexturedSquare = NSBezelStyle.SmallSquare,

    /**
     * @deprecated Use Push instead.
     */
    Rounded = NSBezelStyle.Push,

    /**
     * @deprecated Use FlexiblePush instead.
     */
    RegularSquare = NSBezelStyle.FlexiblePush,

    /**
     * @deprecated Use Toolbar instead.
     */
    TexturedRounded = NSBezelStyle.Toolbar,

    /**
     * @deprecated Use AccessoryBarAction instead.
     */
    RoundRect = NSBezelStyle.AccessoryBarAction,

    /**
     * @deprecated Use AccessoryBar instead.
     */
    Recessed = NSBezelStyle.AccessoryBar,

    /**
     * @deprecated Use PushDisclosure instead.
     */
    RoundedDisclosure = NSBezelStyle.PushDisclosure,

    /**
     * @deprecated Use Badge instead.
     */
    Inline = NSBezelStyle.Badge,
}

// Bitset options for the autoresizingMask
export enum NSAutoresizingMaskOptions {
    NotSizable = 0,
    MinXMargin = 1,
    WidthSizable = 2,
    MaxXMargin = 4,
    MinYMargin = 8,
    HeightSizable = 16,
    MaxYMargin = 32,
}

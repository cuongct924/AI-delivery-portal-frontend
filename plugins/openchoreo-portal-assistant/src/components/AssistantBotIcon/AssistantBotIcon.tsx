import SvgIcon, { SvgIconProps } from '@material-ui/core/SvgIcon';

/**
 * Robot-head glyph for the Portal Assistant — replaces the generic chat
 * bubble so the entry points (FAB, launcher, drawer header) read as "AI
 * assistant" at a glance. Hand-rolled because `@material-ui/icons` v4 has no
 * `SmartToy`; the eye/mouth cut-outs use `fillRule="evenodd"` so the icon
 * inherits `currentColor` like every other Material icon.
 */
export const AssistantBotIcon = (props: SvgIconProps) => (
  <SvgIcon viewBox="0 0 24 24" {...props}>
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 1.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm-.75 2.5h1.5v2h-1.5V4ZM7 6h10a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3Zm2 3.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm6 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm-5.5 5h5v1.5h-5V14.5Z"
    />
  </SvgIcon>
);

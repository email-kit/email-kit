import {
  type Child,
  EmailKitError,
  type IrNode,
  role,
  type TextValue,
  useTheme,
} from "@email-kit/core"

import { Block } from "./Block.tsx"
import { font } from "./style.ts"

interface ImageBase {
  /** An absolute `https:` URL to a PNG, JPEG or GIF */
  readonly src: TextValue
  /** The display width in px; serve about twice as many pixels for sharp HiDPI screens */
  readonly width: number
  readonly height: number
  /** Scale down to the container's width on narrow screens. Default: false */
  readonly fluid?: boolean
  /** The theme's image radius. Word draws square corners. Default: false */
  readonly rounded?: boolean
  readonly align?: "left" | "center"
}

/** Adds nothing a reader needs: `alt=""`, so screen readers skip it. */
export interface DecorativeImage extends ImageBase {
  readonly kind: "decorative"
}

/** Carries content: the alt says what the image shows (text in an image: the exact text). */
export interface InformativeImage extends ImageBase {
  readonly kind: "informative"
  readonly alt: Child
}

/** A linked image: the alt names the destination or action, never "image of". */
export interface FunctionalImage extends ImageBase {
  readonly kind: "functional"
  readonly alt: Child
  readonly href: TextValue
}

export type ImageProps = DecorativeImage | InformativeImage | FunctionalImage

const FORMATS = /\.(png|jpe?g|gif)$/i

/**
 * A content image (UI-11). Integer `width` and `height` attributes, because Word ignores CSS
 * widths on images and blocked images keep their space; `display:block` against the baseline
 * gap; styled alt text for classic Outlook, which blocks images by default (research 01 §6.2,
 * 02 A15, A16). Literal URLs are checked here; data-driven ones by the URL policy (P1-181).
 */
export function Image(props: ImageProps): IrNode {
  const theme = useTheme()
  check(props)
  const alt = props.kind === "decorative" ? "" : props.alt
  const img = (
    <img
      src={props.src}
      alt={alt}
      width={String(props.width)}
      height={String(props.height)}
      border="0"
      style={{
        display: "block",
        ...(props.fluid ? { width: "100%", maxWidth: `${props.width}px`, height: "auto" } : {}),
        border: "0",
        outline: "none",
        textDecoration: "none",
        ...(props.rounded && { borderRadius: `${theme.radius.image}px` }),
        // Shown in place of a blocked image, on the client's ground.
        ...font("bodySm", theme),
        color: role("mutedInk"),
      }}
    />
  )
  return (
    <Block bottom={theme.space.stack.md}>
      {props.align === "center" ? (
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tbody>
            <tr>
              <td align="center">{link(props, img)}</td>
            </tr>
          </tbody>
        </table>
      ) : (
        link(props, img)
      )}
    </Block>
  )
}

function link(props: ImageProps, img: IrNode): IrNode {
  if (props.kind !== "functional") return img
  return (
    <a href={props.href} target="_blank" rel="noopener" style={{ textDecoration: "none" }}>
      {img}
    </a>
  )
}

function fail(message: string): never {
  throw new EmailKitError("invalid-image", `<Image>: ${message}`)
}

function check(props: ImageProps): void {
  for (const side of ["width", "height"] as const) {
    if (!Number.isInteger(props[side]) || props[side] <= 0) {
      fail(`${side} must be a whole number of px, not ${props[side]}`)
    }
  }
  if (props.kind !== "decorative" && typeof props.alt === "string" && !props.alt.trim()) {
    fail(
      `a${props.kind === "informative" ? "n informative" : " functional"} image needs alt text; use kind="decorative" for an image that adds nothing`,
    )
  }
  if (typeof props.src !== "string") return
  let url: URL
  try {
    url = new URL(props.src)
  } catch {
    fail(`src must be an absolute https: URL, not "${props.src}"`)
  }
  if (url.protocol !== "https:") fail(`src must use https:, not ${url.protocol} ("${props.src}")`)
  if (/\.svg$/i.test(url.pathname)) {
    fail("SVG shows blank in Outlook on the web and new Outlook; use a PNG")
  }
  if (/\.(webp|avif)$/i.test(url.pathname)) {
    fail("classic Outlook can't show WebP or AVIF; use a PNG or JPEG")
  }
  if (!FORMATS.test(url.pathname)) {
    fail(`src must be a .png, .jpg or .gif file ("${props.src}")`)
  }
}

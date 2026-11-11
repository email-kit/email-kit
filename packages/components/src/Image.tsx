import {
  type Child,
  EmailKitError,
  type IrNode,
  role,
  type TextValue,
  useTheme,
} from "@email-kit/core"

import { Block } from "./Block.tsx"
import { font, PRESENTATION } from "./style.ts"

interface ImageBase {
  /**
   * The image's address: an `https:` URL to a PNG, JPEG or GIF file, or a URL field from data.
   * SVG, WebP and AVIF don't show in some versions of Outlook.
   */
  readonly src: TextValue
  /**
   * The width it's shown at, in pixels. For sharp images on high-resolution screens, make the file
   * about twice as wide.
   */
  readonly width: number
  /** The height it's shown at, in pixels. Its space is kept while the image loads or is blocked. */
  readonly height: number
  /** Whether it shrinks to fit narrow screens, keeping its shape. Defaults to `false`. */
  readonly fluid?: boolean
  /**
   * Whether it gets the theme's rounded corners. Classic Outlook shows square corners. Defaults to
   * `false`.
   */
  readonly rounded?: boolean
  /**
   * The alignment. Leave it out to align with the text: left, or right in right-to-left emails.
   */
  readonly align?: "left" | "center"
}

/** An image that adds nothing a reader needs, such as a banner. Screen readers skip it. */
export interface DecorativeImage extends ImageBase {
  readonly kind: "decorative"
}

/** An image that shows something the reader needs, such as a product photo or a chart. */
export interface InformativeImage extends ImageBase {
  readonly kind: "informative"
  /** What the image shows. For an image of text, the text itself. */
  readonly alt: Child
}

/** An image that's a link, such as a logo linking to your site. */
export interface FunctionalImage extends ImageBase {
  readonly kind: "functional"
  /** Where the link goes or what it does, such as "Acme home page", not "image of a logo". */
  readonly alt: Child
  /** Where the link goes: a URL, or a URL field from data. */
  readonly href: TextValue
}

/**
 * The props of an `Image`. `kind` says what the image is for, which decides whether it needs `alt`
 * text and an `href`.
 */
export type ImageProps = DecorativeImage | InformativeImage | FunctionalImage

const FORMATS = /\.(png|jpe?g|gif)$/i

/**
 * An image, with the theme's gap below it. Classic Outlook and some other clients block images
 * until the reader allows them, so the `alt` text shows in their place, in small muted type.
 *
 * @param props - What the image is for, its URL and size, and how to show it.
 *
 * @throws {EmailKitError} If `width` or `height` isn't a whole number above 0, if an informative
 *   or functional image has empty `alt` text, or if a written-out `src` isn't an `https:` URL to a
 *   PNG, JPEG or GIF file.
 *
 * @example
 * ```tsx
 * <Image
 *   kind="functional"
 *   src="https://example.com/logo.png"
 *   alt="Acme home page"
 *   href="https://example.com"
 *   width={120}
 *   height={40}
 * />
 * <Image
 *   kind="informative"
 *   src={data.productImage}
 *   alt={data.productName}
 *   width={536}
 *   height={300}
 *   fluid
 * />
 * ```
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
        ...(props.fluid && { width: "100%", maxWidth: `${props.width}px`, height: "auto" }),
        border: "0",
        outline: "none",
        textDecoration: "none",
        ...(props.rounded && { borderRadius: `${theme.radius.image}px` }),
        ...font("bodySm", theme),
        color: role("mutedInk"),
      }}
    />
  )
  return (
    <Block bottom={theme.space.stack.md}>
      {props.align ? (
        <table {...PRESENTATION}>
          <tbody>
            <tr>
              <td align={props.align}>{link(props, img)}</td>
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

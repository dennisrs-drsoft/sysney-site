import NextImage, { type ImageProps } from "next/image";
import type { Ref } from "react";
import placeholders from "./screen-placeholders.json";

// Local, tiny previews are in the HTML, before the full screenshot is downloaded.
export default function SiteImage(props: ImageProps & { ref?: Ref<HTMLImageElement> }) {
  const src = props.src === "/sisblink/telas/catalogo-detalhado.png"
    ? "/sisblink/telas/catalogo-detalhado.webp" : props.src;
  const preview = typeof src === "string" ? placeholders[src as keyof typeof placeholders] : undefined;
  return <NextImage {...props} src={src} placeholder={props.placeholder ?? (preview ? "blur" : "empty")} blurDataURL={props.blurDataURL ?? preview} />;
}

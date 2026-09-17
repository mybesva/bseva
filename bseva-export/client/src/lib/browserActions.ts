export async function copyTextSafely(text: string): Promise<void> {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const input = document.createElement("textarea");
  input.value = text;
  input.readOnly = true;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("Copy unavailable");
}

export async function shareSafely(data: ShareData): Promise<"shared" | "copied"> {
  if (navigator.share) {
    await navigator.share(data);
    return "shared";
  }
  await copyTextSafely([data.text, data.url].filter(Boolean).join("\n"));
  return "copied";
}

// ok
export const ensureViewportMeta = (): void => {
  // Don't add meta tag if it would conflict with host page
  if (!document.querySelector('meta[name="viewport"]')) {
    const meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    meta.setAttribute('data-coolchat-added', 'true');
    document.head.appendChild(meta);
  }
};
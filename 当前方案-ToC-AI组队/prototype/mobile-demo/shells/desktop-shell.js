export function renderDesktopShell({ content, navigation }) {
  return `
    <main class="desktop-app-shell" data-app-shell="desktop">
      <section class="desktop-app-frame" aria-label="COSPAN 合拍桌面协作控制台">
        <div class="desktop-screen">${content}</div>
        ${navigation}
      </section>
    </main>
  `;
}

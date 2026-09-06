export function renderMobileShell({ content, navigation, notes }) {
  return `
    <main class="prototype-stage" data-app-shell="mobile">
      <section class="phone-shell" aria-label="COSPAN 合拍移动应用">
        <div class="screen">${content}</div>
        ${navigation}
      </section>
      ${notes}
    </main>
  `;
}

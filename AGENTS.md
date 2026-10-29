<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Native store apps use Capacitor as a remote shell loading the published URL (capacitor.config.ts); why: the app is server-rendered, so a static bundle can't run it.
- Nickname changes and friendship actions use authenticated database RPCs; nickname changes lock the profile and record a transaction, so identity uniqueness and charges cannot be bypassed or raced.
- Player search and friend lists project only nickname, stable profile ID and cosmetics through authenticated RPCs; this keeps emails, balances and private profile fields out of discovery.
- Profile and Settings share NicknameForm; this keeps rename pricing and payment confirmation consistent across entry points.
- Managed social sign-in uses the generated Lovable helper with a public same-origin return URL; AuthProvider confirms the session before navigating to protected pages.

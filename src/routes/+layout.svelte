<script>
  import { page } from '$app/stores';
</script>

<nav>
  <a href="/do" class:active={$page.url.pathname.startsWith('/do')}>Do</a>
  <a href="/journal" class:active={$page.url.pathname.startsWith('/journal')}>Journal</a>
  <a href="/goals" class:active={$page.url.pathname.startsWith('/goals')}>Goals</a>
</nav>

<slot />

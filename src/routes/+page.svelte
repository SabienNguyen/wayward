<script lang="ts">
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth.svelte';

  $effect(() => {
    if (!authStore.loading) {
      goto(authStore.user ? '/goals' : '/login', { replaceState: true });
    }
  });
</script>

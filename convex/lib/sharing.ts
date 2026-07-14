export function isPublicPoemShareEnabled(
  poem: { publicShareEnabled?: boolean } | null
) {
  return poem?.publicShareEnabled === true;
}

export function isPublicSessionRecapEnabled(
  game: { publicRecapEnabled?: boolean } | null
) {
  return game?.publicRecapEnabled === true;
}

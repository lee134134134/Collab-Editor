export default function access(
  initialState: { currentUser?: { name?: string } } | undefined,
) {
  const { currentUser } = initialState ?? {};
  return {
    canAdmin: !!currentUser?.name,
  };
}

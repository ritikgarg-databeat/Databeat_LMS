/** Remove server-internal storage pointers before a lesson resource crosses the API boundary. */
export function toClientResource<T extends { relativePath: unknown }>(resource: T): Omit<T, 'relativePath'> {
  const { relativePath, ...clientResource } = resource;
  void relativePath;
  return clientResource;
}

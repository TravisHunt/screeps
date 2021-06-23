interface IOwnedStructure extends IStructure {
  readonly my: boolean;
  readonly owner: Owner | undefined;
}

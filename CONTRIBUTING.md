# Contribution Guidelines

## Raising an Issue

If you raise an issue against this repository, please include as much information as possible to reproduce any bugs,
or specific locations in the case of content errors.

## Contributing code

To contribute code, please fork the repository and raise a pull request.

Ideally pull requests should be fairly granular and aim to solve one problem each. It would also be helpful if they
linked to an issue. If the maintainers cannot understand why a pull request was raised, it will be rejected,
so please explain why the changes need to be made (unless it is self-evident).

### Merge responsibility

* It is the responsibility of the reviewer to merge branches they have approved.
* It is the responsibility of the author of the merge to ensure their merge is in a mergeable state.
* It is the responsibility of the maintainers to ensure the merge process is unambiguous and automated where possible.

### Branch naming

Branch names should be of the format:

`apm-nnn-short-issue-description`

Multiple branches are permitted for the same ticket.

### Commit messages

We do not enforce any conventions on commit messages to a branch, as we use squash commits when merging to main branch.

Commits from a pull request get squashed into a single commit on merge, using the pull request title as the commit message.
Please format your pull request title using tags from [ESLint Convention](https://github.com/conventional-changelog/conventional-changelog/tree/master/packages/conventional-changelog-eslint) as follows:

```text
Tag: [AEA-NNNN] - Short description
```

Tag can be one of:

* `Fix` - for a bug fix. (Patch release)
* `Update` - either for a backwards-compatible enhancement or for a rule change that adds reported problems. (Patch release)
* `New` - implemented a new feature. (Minor release)
* `Breaking` - for a backwards-incompatible enhancement or feature. (Major release)
* `Docs` - changes to documentation only. (Patch release)
* `Build` - changes to build process only. (No release)
* `Upgrade` - for a dependency upgrade. (Patch release)
* `Chore` - for refactoring, adding tests, etc. (anything that isn't user-facing). (Patch release)

If the current release is x.y.z then

* a patch release increases z by 1
* a minor release increases y by 1
* a major release increases x by 1

Correct tagging is necessary for our automated versioning and release process ([Release](./RELEASE.md)).

### Changelog

Release changelogs are generated from the titles of pull requests merged into the `main` branch. Please ensure that your pull request title is sufficiently descriptive of the changes made.

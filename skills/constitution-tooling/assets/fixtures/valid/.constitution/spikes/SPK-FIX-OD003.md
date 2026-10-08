# Spike report: OD-03 Heading anchor collisions

## Effort budget

- **Budget:** 2
- **Spent:** 1

## Question

- **Owner:** OD-03
- **Decision this spike must produce:** how the renderer disambiguates two headings that slugify to the same anchor.

## Options and trade-offs

- Numeric suffix against content hash; the sample corpus produced 14 collisions, all resolved by a numeric suffix.

## Recommendation

- **Chosen option:** numeric suffix, because it stays stable when unrelated headings change.

## Downstream impact

- **ADRs to write or update:** none
- **Tickets unblocked:** none
- **Register entry closed:** OD-03, numeric suffix

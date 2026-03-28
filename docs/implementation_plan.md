# Refine Student Distribution Algorithm

The goal is to update the exam distribution algorithm to strictly enforce neighbor constraints, prioritize special-coded students, and implement specific column patterns as requested.

## User Review Required

> [!IMPORTANT]
> The algorithm will prioritize non-neighboring students of the **exact same exam** (e.g., Physics 9 cannot be next to Physics 9). Students from different exams (e.g., Physics 9 and Physics 10) **can** be neighbors.

> [!NOTE]
> Students with special codes (`ogrenciKodu`) will now be explicitly targeted for the first two rows (Row 1 and Row 2) of each classroom, as they are "closest to the board".

## Proposed Changes

### Algorithm Component

#### [MODIFY] [algorithm.js](file:///a:/TOOLS/kodlama\km\KLBK%20FRVR/js/algorithm.js)
1.  **Refine `findSafe` and `hasCollision6`**: Ensure these functions are used consistently to check for lateral and diagonal neighbors (distance-1 neighbors except vertical).
2.  **Update Priority Student Placement**: Modify `AŞAMA 1` to strictly prefer the two front rows (Row 1 and Row 2) for students with `ogrenciKodu`.
3.  **Implement Column Interleaving**: Refactor `OPT-V` Pass 1 to use an interleaving logic instead of a grouping logic. If a column has students from multiple exams (e.g., A, A, A, B, B), they will be arranged as (A, B, A, B, A).
4.  **Strengthen Swapping Logic**: Enhance `OPT-V` Pass 4 and `OPT-V-CrossRoom` to prioritize resolving lateral/diagonal collisions above all else, allowing vertical neighbors as a fallback during swaps.
5.  **Add Pass 5: Extreme Resolution**: Implement a pass that specifically scans for any remaining high-penalty (lateral/diagonal) collisions and attempts to swap them into lower-penalty (vertical) ones if no perfect spot exists.
6.  **Fallback Strategy**: Ensure that if all optimization passes fail to resolve a neighbor conflict, the algorithm yields the best possible result (allowing vertical neighbors as a last resort).

## Open Questions

1.  **Definitions**: Confirming that "Fizik 9" and "Fizik 10" are considered *different* exams and students from these can be neighbors, or should they also be isolated from each other? (The current code treats them as different levels/subjects if they have different names).
2.  **Back-to-back fallback**: When the non-neighbor condition cannot be met, is it acceptable to allow vertical neighbors even if other empty seats exist? (Usually, yes, if swapping doesn't help).

## Verification Plan

### Automated Tests
- I will run a simulation using `test_alg.js` (if it works) or a similar script to verify that:
  - Students with codes are in the front 2 rows.
  - Columns with mixed exams show the A-B-A-B pattern.
  - Same-exam neighbors are minimized/eliminated.

### Manual Verification
- Visual inspection of the distribution results in the "Sınav Dağıtımı" view in the application.

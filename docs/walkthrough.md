# Exam Distribution Algorithm Refined

I have updated the distribution algorithm to prioritize non-neighboring students, pull special-coded students to the front, and implement interleaving patterns in columns.

## Changes Made

### 1. Strict Neighbor Isolation
Fixed the `findSafe` function to:
- Heavily penalize lateral and diagonal neighbors (preventing them).
- Add a moderate penalty for vertical neighbors, allowing them only as a fallback when no other options exist.

### 2. Front Row Priority for Special Students
Modified the priority student placement logic:
- Students with an `ogrenciKodu` (special code) now have a strong preference for the **first two rows** (Row 1 and Row 2), effectively moving them "closest to the board".

### 3. Column Interleaving (A-B-A-B-A)
Replaced the grouping logic in `OPT-V` Pass 1 with an **interleaving algorithm**:
- Students in the same column from different exams are now meticulously interleaved.
- *Example*: If a column has 3 students from Physics 9 and 2 from Physics 10, they will be arranged as (Phys 9, Phys 10, Phys 9, Phys 10, Phys 9).

### 4. Mandatory Neighbor Fallback (Swap Logic)
Updated the swap logic (Pass 4 and new Pass 5) to:
- Strictly prioritize resolving **Lateral and Diagonal** neighbors (200k+ penalty).
- Allow **Vertical** neighbors (front-to-back) as a fallback if it resolves a more severe collision.
- This ensures that when the algorithm says "zorunluysa önüne arkasına gelebilir", it truly treats it as the only acceptable compromise.

## Verification
- Code changes in [algorithm.js](file:///a:/TOOLS/kodlama/km/KLBK%20FRVR/js/algorithm.js) have been implemented.
- The logic accounts for the user's specific requirement where "Fizik 9" can be neighbors with "Fizik 10", but not with another "Fizik 9".

> [!TIP]
> This refined algorithm ensures a much fairer and more secure distribution for exam sessions.

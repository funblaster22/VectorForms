/**
 * Compute the weighted Euclidean distance (sum of (vec1_n - vec2_n ) ^ 2) between two vectors
 * @param vec1 {Vector}
 * @param vec2 {Vector}
 * @param weights {Vector} must be the same length as `vec1` & `vec2`
 */
export function euclideanDistance(vec1, vec2, weights) {
  console.assert(vec1.length === vec2.length);
  let diffSquareSums = 0;
  for (let idx=0; idx<vec1.length; idx++) {
    diffSquareSums += weights[idx] * Math.pow(vec1[idx] - vec2[idx], 2);
  }
  return Math.sqrt(diffSquareSums);
}

// eslint-disable-next-line no-undef
const loadedUSE = use.load();

/**
 * Converts a dictionary to an array in the order specified by `keyorder`
 * @template {Record<string, number | string>} T
 * @param dict {T}
 * @param keyorder {(keyof T)[]}
 */
export function dictToVec(dict, keyorder) {
  const valueVec = [];
  for (const key of keyorder) {
    const val = dict[key];
    if (typeof val === "number") {
      valueVec.push(Promise.resolve(val));
    } else if (typeof val === "string") {
      // Tokenizer doesn't return fixed-size array
      const wordEmbedding = loadedUSE
        .then(model => {
          return model.embed([val])
            .then(embeddings => {
              return embeddings.arraySync()[0];
            });
        })
        .catch(err => console.error("Fit Error:", err));
      valueVec.push(wordEmbedding);
    } else {
      console.error(typeof val, "not yet supported", val);
    }
  }
  return Promise.all(valueVec);
}

/**
 * Converts a mapping of {questions: weight} to array of [weight_1, weight_1, weight_2, ...] depending on how big its corresponding value expands to
 * For example, strings take 512 spaces, so that weight must also take 512 parallel spaces
 * @template {Record<string, number | string>} T
 * @param dict {T}
 * @param keyorder {(keyof T)[]}
 * @param weights {{[p: keyof T]: number | undefined}} If weight does not exist for key, defaults to `1`
 * @returns {Vector}
 */
export function expandWeights(dict, keyorder, weights) {
  const weightVec = [];
  for (const key of keyorder) {
    const val = dict[key];
    const weight = weights[key] ? weights[key] : 1;  // TODO: upgrade babel to use `??`
    let subLength = 0;
    if (typeof val === "number") {
      subLength = 1;
    } else if (typeof val === "string") {
      subLength = 512;
    } else {
      console.error(typeof val, "not yet supported", val);
    }
    weightVec.push(...Array(subLength).fill(weight));
  }
  return weightVec.flat();
}

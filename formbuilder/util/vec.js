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
    // Multiply one val by weight sign to optimize difference if negative
    diffSquareSums += weights[idx] * Math.pow(vec1[idx] - vec2[idx] * Math.sign(weights[idx]), 2);
  }
  return Math.sqrt(diffSquareSums);
}

// eslint-disable-next-line no-undef
const loadedUSE = use.load();

function enumToVec(options, selected) {
  // TODO: add option to allow treating enum as linear (instead of one-hot encoding)
  const vec = [];
  for (const option of options) {
    vec.push(Number(selected.includes(option)) * 2 - 1);
  }
  return vec;
}

/**
 * Converts a dictionary to an array in the order specified by `keyorder`
 * @template {Record<string, number | string>} T
 * @param dict {T}
 * @param keyorder {(keyof T)[]}
 */
export function dictToVec(dict, keyorder, schemaProperties) {
  const valueVec = [];
  for (const key of keyorder) {
    const val = dict[key];
    // I considered baking the weights into the vector, but this doesn't work for negative weights b/c since all are same, not really checking for difference
    if (typeof val === "number") {
      valueVec.push(Promise.resolve(val));
    } else if (typeof val === "string") {
      if ("enum" in schemaProperties[key]) {
        valueVec.push(Promise.resolve(enumToVec(schemaProperties[key].enum, [val])));
        continue;
      }
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
    } else if (Array.isArray(val)) {
      valueVec.push(Promise.resolve(enumToVec(schemaProperties[key].items.enum, val)));
    } else if (typeof val === "boolean") {
      valueVec.push(Promise.resolve(Number(val) * 2 - 1));
    } else {
      console.error(typeof val, "not supported", val);
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
export function expandWeights(dict, keyorder, weights, schemaProperties) {
  const weightVec = [];
  for (const key of keyorder) {
    const val = dict[key];
    const weight = weights[key] ? weights[key] : 1;  // TODO: upgrade babel to use `??`
    let subLength = 0;
    if (typeof val === "number") {
      subLength = 1;
    } else if (typeof val === "string") {
      subLength = 512;
      if ("enum" in schemaProperties[key]) {
        subLength = schemaProperties[key].enum.length;
      }
    } else if (Array.isArray(val)) {
      subLength = schemaProperties[key].items.enum.length;
    } else if (typeof val === "boolean") {
      subLength = 1;
    } else {
      console.error(typeof val, "not supported", val);
    }
    weightVec.push(...Array(subLength).fill(weight));
  }
  return weightVec;
}

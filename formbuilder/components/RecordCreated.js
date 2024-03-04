import React, {Component} from "react";
import config from "../config";
import {clone} from "../reducers/form";

/**
 * A vector containing either number literals or flattened encoding of string
 * @typedef {number[]} Vector
 */

export default class RecordCreated extends Component {
  componentDidMount() {
    // Issue #130 - Change title back to project name after submitting the form
    document.title = config.projectName;

    const adminToken = this.props.params.formId;
    this.formID = adminToken;
    this.props.getRecords(adminToken);
    this.props.loadSchema(this.formID);
  }

  /**
   * Compute the weighted Euclidean distance (sum of (vec1_n - vec2_n ) ^ 2) between two vectors
   * @param vec1 {Vector}
   * @param vec2 {Vector}
   * @param weights {Vector} must be the same length as `vec1` & `vec2`
   */
  euclideanDistance(vec1, vec2, weights) {
    console.assert(vec1.length === vec2.length);
    let diffSquareSums = 0;
    for (let idx=0; idx<vec1.length; idx++) {
      diffSquareSums += weights[idx] * Math.pow(vec1[idx] - vec2[idx], 2);
    }
    return Math.sqrt(diffSquareSums);
  }

  /**
   * Converts a dictionary to an array in the order specified by `keyorder`
   * @template {Record<string, number | string>} T
   * @param dict {T}
   * @param weights {{[p: keyof T]: number | undefined}} If weight does not exist for key, defaults to `1`
   * @param keyorder {(keyof T)[]}
   */
  dictToVec(dict, keyorder, weights={}) {
    /** @type {Vector} */
    const valueVec = [];
    /** @type {Vector} */
    const weightVec = [];
    for (const key in keyorder) {
      const val = dict[key];
      if (typeof val === "number") {
        valueVec.push(val);
        weightVec.push(weights[key] ? weights[key] : 1);  // TODO: upgrade js to use `??`
      } else {
        // TODO: encode strings
        console.warn(typeof val, "not yet supported");
      }
    }
    return [valueVec, weightVec];
  }

  render() {
    const properties = this.props.schema.properties;
    const title = this.props.schema.title;
    const records = clone(this.props.records);
    const ready = Object.keys(properties).length !== 0;
    const schemaFields = this.props.uiSchema["ui:order"];

    const mySubmissionIdx = records.findIndex(record => record.id === localStorage.uid);
    if (mySubmissionIdx === -1) {
      return <a href={"#/form/" + this.formID}>You have not yet filled out this form!</a>;
    }
    if (records.length === 1) {
      return <p>You're the first person to complete this form! Check back later to form your team.</p>;
    }
    const [mySubmissionVec, weights] = this.dictToVec(records.splice(mySubmissionIdx, 1)[0], schemaFields, this.props.schema.weights);

    // TODO: a heap is probably better
    for (const record of records) {
      record.similarity = this.euclideanDistance(mySubmissionVec, this.dictToVec(record, schemaFields)[0], weights);
    }
    records.sort((a, b) => a.similarity - b.similarity);

    console.log(records, weights);

    let content = "loading";
    if (ready) {
      content = (
        <div>
          <h3>Matches for {title}</h3>
          <table className="table table-striped">
            <thead>
            <tr>{
              schemaFields.map((key) => {
                return <th key={key}>{properties[key].title}</th>;
              })
            }</tr>
            </thead>
            <tbody>
            {records.map((record, idx) => {
              return (<tr key={idx}>{
                schemaFields.map((key) => {
                  return <td key={key}>{String(record[key])}</td>;
                })}
              </tr>);
            })}
            </tbody>
          </table>
        </div>);
    }
    return <div className="test">{content}</div>;
  }
}

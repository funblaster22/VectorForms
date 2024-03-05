import React, {Component} from "react";
import config from "../config";
import {clone} from "../reducers/form";
import {getUid} from "../util/login";
import {addMember, dropMember} from "../actions/server";

/**
 * A vector containing either number literals or flattened encoding of string
 * @typedef {number[]} Vector
 */

export default class RecordCreated extends Component {
  state = {
    // Numeric representation of this.props.records
    recordsVec: [],
    // Array of length `recordsVec` that encodes the weight for each respective dimension in `recordsVec`
    weights: [],
  }

  constructor(props) {
    super(props);

    // Issue #130 - Change title back to project name after submitting the form
    document.title = config.projectName;
    this.fetchInitiated = false;
    // eslint-disable-next-line no-undef
    this.loadedUSE = use.load();
  }

  componentDidUpdate(prevProps, prevState, snapshot) {
    // TODO: There is definitely a better way to do this (redux) but I don't wanna deal with that
    if (!this.fetchInitiated && this.props.records.length && this.props.uiSchema["ui:order"].length) {
      this.fetchInitiated = true;
      Promise.all(
        this.props.records.map(record => this.dictToVec(record, this.props.uiSchema["ui:order"], this.props.schema.weights))
      ).then(recordsVec => this.setState({recordsVec: recordsVec.flat()}));
    }
  }

  componentDidMount() {
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
    const valueVec = [];
    const weightVec = [];
    for (const key of keyorder) {
      const val = dict[key];
      const weight = weights[key] ? weights[key] : 1;
      if (typeof val === "number") {
        valueVec.push(Promise.resolve(val));
        weightVec.push(Promise.resolve(weight));  // TODO: upgrade babel to use `??`
      } else if (typeof val === "string") {
        // Tokenizer doesn't return fixed-size array
        const wordEmbedding = this.loadedUSE
          .then(model => {
            return model.embed([val])
              .then(embeddings => {
                return embeddings.arraySync()[0];
              });
          })
          .catch(err => console.error("Fit Error:", err));
        valueVec.push(wordEmbedding);
        weightVec.push(wordEmbedding.then(embeddings => Array(embeddings.length).fill(weight)));
      } else {
        console.error(typeof val, "not yet supported", val);
      }
    }
    Promise.all(weightVec).then(weights => this.setState({weights: weights.flat()}));  // This will fire many times, but should be same so nothing happens TODO: fix
    return Promise.all(valueVec);
  }

  render() {
    const properties = this.props.schema.properties;
    const title = this.props.schema.title;
    const records = clone(this.props.records);
    const ready = Object.keys(properties).length !== 0;
    const schemaFields = this.props.uiSchema["ui:order"];

    const mySubmissionIdx = records.findIndex(record => record.id === localStorage.uid);
    const myRecord = records[mySubmissionIdx];
    if (mySubmissionIdx === -1) {
      return <a href={"#/form/" + this.formID}>You have not yet filled out this form!</a>;
    }
    if (records.length === 1) {
      return <p>You're the first person to complete this form! Check back later to form your team.</p>;
    }
    if (this.state.recordsVec.length > 0) {
      const mySubmissionVec = this.state.recordsVec[mySubmissionIdx];

      for (let recordIdx = 0; recordIdx < records.length; recordIdx++) {
        if (recordIdx === mySubmissionIdx) {
          continue;
        }
        const record = records[recordIdx];
        const recordVec = this.state.recordsVec[recordIdx];
        record.similarity = this.euclideanDistance(mySubmissionVec, recordVec, this.state.weights);
      }
      records.sort((a, b) => b.similarity - a.similarity);
    }

    let content = "loading";
    if (ready) {
      content = (
        <div>
          <h3>Matches for {title}</h3>
          <table className="table table-striped">
            <thead>
            <tr>
              {
                schemaFields.map((key) => {
                  return <th key={key}>{properties[key].title}</th>;
                })
              }
              <th>Similarity</th>
              <th>Group</th>
            </tr>
            </thead>
            <tbody>
            {records.map((record, idx) => {
              if (idx === mySubmissionIdx) {
                return;
              }
              const inTheirMembers = record.members && record.members.includes(getUid());
              const inMyMembers = myRecord.members && myRecord.members.includes(record.id);
              return (
                <tr key={idx}>
                  {
                  schemaFields.map((key) => {
                    return <td key={key}>{String(record[key])}</td>;
                  })}
                  <td>{record.similarity ? record.similarity : "loading..."}</td>
                  <td>
                    {inMyMembers &&
                    <button type="button" onClick={dropMember.bind(this, this.formID, record.id, myRecord)} className="btn">
                      {inTheirMembers ? "Drop" : "Cancel Invitation"}
                    </button>}
                    {!inMyMembers &&
                    <button type="button" onClick={addMember.bind(this, this.formID, record.id, myRecord)} className="btn btn-primary">
                      {inTheirMembers ? "Accept & Join" : "Invite"}
                    </button>}
                  </td>
                </tr>
              );
            })}
            </tbody>
          </table>
        </div>);
    }
    return <div className="test">{content}</div>;
  }
}

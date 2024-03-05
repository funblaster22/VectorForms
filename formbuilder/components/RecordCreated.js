import React, {Component} from "react";
import config from "../config";
import {clone} from "../reducers/form";
import {getUid} from "../util/login";
import {addMember, dropMember} from "../actions/server";
import {euclideanDistance, expandWeights} from "../util/vec";

/**
 * A vector containing either number literals or flattened encoding of string
 * @typedef {number[]} Vector
 */

export default class RecordCreated extends Component {
  constructor(props) {
    super(props);

    // Issue #130 - Change title back to project name after submitting the form
    document.title = config.projectName;
  }

  componentDidMount() {
    const adminToken = this.props.params.formId;
    this.formID = adminToken;
    this.props.getRecords(adminToken);
    this.props.loadSchema(this.formID);
  }

  shouldntInclude(key) {
    return this.props.schema.weights[key] === 0 || key === "email";
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
    if (records.length > 0) {
      /** Array of length `recordsVec` that encodes the weight for each respective dimension in `recordsVec` */
      const weights = expandWeights(myRecord, schemaFields, this.props.schema.weights);

      for (let recordIdx = 0; recordIdx < records.length; recordIdx++) {
        if (recordIdx === mySubmissionIdx) {
          continue;
        }
        const record = records[recordIdx];
        record.similarity = euclideanDistance(myRecord.vector, record.vector, weights);
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
                  if (this.shouldntInclude(key)) {
                    return;
                  }
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
                    if (this.shouldntInclude(key)) {
                      return;
                    }
                    return <td key={key}>{String(record[key])}</td>;
                  })}
                  <td>{record.similarity ? record.similarity : "loading..."}</td>
                  <td>
                    {inMyMembers &&
                    <button type="button" onClick={dropMember.bind(this, this.formID, record.id, myRecord)} className="btn btn-primary">
                      {inTheirMembers ? "Leave" : "Cancel Invitation"}
                    </button>}
                    {!inMyMembers &&
                    <button type="button" onClick={addMember.bind(this, this.formID, record.id, myRecord)} className={`btn ${inTheirMembers ? "btn-primary" : ""}`}>
                      {inTheirMembers ? "Accept & Join" : "Invite"}
                    </button>}
                    {(inMyMembers && inTheirMembers) &&
                    <a href={"mailto:" + record.email} style={{marginLeft: "0.5em"}}>Contact</a>
                    }
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

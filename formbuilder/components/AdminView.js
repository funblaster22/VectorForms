import React, { Component } from "react";
import CSVDownloader from "./CSVDownloader";
import XLSDownloader from "./XLSDownloader";
import URLDisplay from "./URLDisplay";
import {getFormID, getFormURL} from "../utils";

import {DropdownButton, MenuItem}  from "react-bootstrap";
import {clone} from "../reducers/form";

export default class AdminView extends Component {
  componentDidMount() {
    const adminToken = this.props.params.adminToken;
    this.formID = adminToken;
    this.props.getRecords(adminToken);
    this.props.loadSchema(this.formID);
  }
  render() {
    const properties = this.props.schema.properties;
    const records = clone(this.props.records);
    const title = this.props.schema.title;
    const ready = Object.keys(properties).length !== 0;
    const schemaFields = [...this.props.uiSchema["ui:order"], "members"];
    const formUrl = getFormURL(this.formID);
    properties.members = {
      title: "members",
    };

    // Resolve members
    for (const record of records) {
      if (!record.members) {
        record.members = [];
      }
      // TODO: upgrade babel so I can use optional chaining 😭
      // TODO: filter to only sho mutual accepts
      // TODO: make `name` a default required field & use that instead
      record.members = record.members.map(teammateId => records.find(record => record.id === teammateId).email);
    }

    let content = "loading";
    if (ready) {
      content = (
      <div>
        <h3>Results for {title}</h3>
        <DropdownButton title="Download results" id="bg-nested-dropdown" className="pull-right">
          <li>
            <CSVDownloader
              schema={this.props.schema}
              fields={schemaFields}
              records={records} />
          </li>
          <li>
            <XLSDownloader
              schema={this.props.schema}
              fields={schemaFields}
              records={records} />
          </li>
        </DropdownButton>
        <URLDisplay url={formUrl} />
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
            }
          )}
          </tr>);
        })}
        </tbody>
        </table>
      </div>);
    }
    return <div className="test">{content}</div>;
  }
}

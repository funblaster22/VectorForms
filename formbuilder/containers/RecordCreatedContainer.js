import { connect } from "react-redux";

import RecordCreated from "../components/RecordCreated";
import {bindActionCreators} from "redux";
import * as ServerActions from "../actions/server";


function mapDispatchToProps(dispatch) {
  return bindActionCreators(ServerActions, dispatch);
}

function mapStateToProps(state) {
  return {
    schema: state.form.schema,
    uiSchema: state.form.uiSchema,
    formData: state.form.formData,
    records: state.records,
  };
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(RecordCreated);

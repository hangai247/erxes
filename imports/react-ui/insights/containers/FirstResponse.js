import { compose } from 'react-komposer';
import { Brands } from '/imports/api/brands/brands';
import { getTrackerLoader, composerOptions } from '/imports/react-ui/utils';
import { FirstResponse } from '../components';
import { MainGraph, UsersData } from '/imports/api/insights/collections';

function composer({ queryParams }, onData) {
  const handle = Meteor.subscribe('insights.first.response', queryParams);
  const brandHandle = Meteor.subscribe('brands.list', 0);

  const brands = Brands.find({}, { sort: { name: 1 } }).fetch();

  if (brandHandle.ready() && handle.ready()) {
    const trend = MainGraph.find().fetch();
    const teamMembers = UsersData.find().fetch();

    onData(null, {
      trend,
      brands,
      teamMembers,
    });
  }
}

export default compose(getTrackerLoader(composer), composerOptions({}))(FirstResponse);

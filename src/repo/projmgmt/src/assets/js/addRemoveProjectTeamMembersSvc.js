// Copyright (c) 2022 Siemens

/**
 * A service that has util methods which can be use in other js files of Project modules.
 *
 * @module js/addRemoveProjectTeamMembersSvc
 */
import _ from 'lodash';

var exports = {};

/**
 * Adds the selected group and group members to selected Project
 * @param {object} uwDataProvider data provider
 * @param {Object} context context
 */
export let addSelectedMembers = function(  subPanelContext, data ) {
    var inputs = [];
    var gms = [];
    var groups = [];
    var groupCount = 0;
    var gmCount = 0;
    var roleCount = 0;
    var groupRoles = [];
    var group;
    var role;
    var i;
    var gmNodeToSelect = [];
    var selectedObjects = data.atomicData.selectionData.selected;
    for( i = 0; i < selectedObjects.length; i++ ) {
        if( selectedObjects[ i ].type === 'Group' ) {
            var currGroup = {
                type: selectedObjects[ i ].object.type,
                uid: selectedObjects[ i ].object.uid
            };
            groups[ groupCount ] = currGroup;
            groupCount++;
        }
        if( selectedObjects[ i ].type === 'GroupMember' ) {
            var currGroupMember = {
                type: selectedObjects[ i ].object.type,
                uid: selectedObjects[ i ].object.uid
            };

            gms[ gmCount ] = currGroupMember;
            gmCount++;
            var userToSelect = selectedObjects[ i ].parent.parent.object.uid + '_' + selectedObjects[ i ].parent.object.uid;
            gmNodeToSelect.push( userToSelect );
        }

        if( selectedObjects[ i ].type === 'Role' ) {
            group = {
                type: selectedObjects[ i ].parent.object.objecttype,
                uid: selectedObjects[ i ].parent.object.uid
            };

            role = {
                type: selectedObjects[ i ].object.type,
                uid: selectedObjects[ i ].object.uid
            };
            groupRoles[ roleCount ] = {
                tcGroup: group,
                tcRole: role,
                isRemovable: true
            };
            roleCount++;
        }
    }

    inputs[ 0 ] = {
        project: subPanelContext.searchState.pwaSelection[0],
        gms: gms,
        groups: groups,
        groupRoles: groupRoles,
        addOrRemove: true
    };
    data.nodes = _.cloneDeep( inputs );
    data.nodes[0].userParentToSelect = gmNodeToSelect;
    return inputs;
};


export default exports = {
    addSelectedMembers
};

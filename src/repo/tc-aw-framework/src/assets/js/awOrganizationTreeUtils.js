/* eslint-disable max-lines */
// Copyright (c) 2022 Siemens

/**
 * A service that has util methods for the Active Workspace Organization module.
 *
 * @module js/awOrganizationTreeUtils
 */
import uwPropertySvc from 'js/uwPropertyService';
import soaService from 'soa/kernel/soaService';
import AwPromiseService from 'js/awPromiseService';
import awTableService from 'js/awTableService';
import appCtxService from 'js/appCtxService';
import iconService from 'js/iconService';
import localeService from 'js/localeService';
import tableStateService from 'js/awTableStateService';
import msgService from 'js/messagingService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import propertyPolicySvc from 'soa/kernel/propertyPolicyService';

var showInactive = false;
var expandedGroupNodes = [];
var grpCount = 0;

var policyIOverride = {
    types: [ {
        name: 'Group',
        properties: [ {
            name: 'name'
        }, {
            name: 'awp0CellProperties'
        }, {
            name: 'object_string'
        }, {
            name: 'awp0ThumbnailImageTicket'
        } ]
    }, {
        name: 'Role',
        properties: [ {
            name: 'role_name'
        }, {
            name: 'awp0CellProperties'
        }, {
            name: 'object_string'
        }, {
            name: 'awp0ThumbnailImageTicket'
        } ]
    }, {
        name: 'User',
        properties: [ {
            name: 'user_name'
        }, {
            name: 'user_id'
        }, {
            name: 'awp0CellProperties'
        }, {
            name: 'object_string'
        }, {
            name: 'awp0ThumbnailImageTicket'
        } ]
    }, {
        name: 'GroupMember',
        properties: [ {
            name: 'group',
            modifiers: [ {
                name: 'withProperties',
                Value: 'true'
            } ]
        }, {
            name: 'role',
            modifiers: [ {
                name: 'withProperties',
                Value: 'true'
            } ]
        }, {
            name: 'user',
            modifiers: [ {
                name: 'withProperties',
                Value: 'true'
            } ]
        }, {
            name: 'awp0CellProperties'
        }, {
            name: 'object_string'
        }, {
            name: 'awp0ThumbnailImageTicket'
        } ]
    } ]
};

/**
 * Adds the selected group and group members to selected Project
 * @param {object} uwDataProvider data provider
 * @param {Object} context context
 */
export let addSelectedMembers = function( uwDataProvider, context, data ) {
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

    for( i = 0; i < uwDataProvider.selectedObjects.length; i++ ) {
        if( uwDataProvider.selectedObjects[ i ].type === 'Group' ) {
            var currGroup = {
                type: uwDataProvider.selectedObjects[ i ].object.type,
                uid: uwDataProvider.selectedObjects[ i ].object.uid
            };
            groups[ groupCount ] = currGroup;
            groupCount++;
        }
        if( uwDataProvider.selectedObjects[ i ].type === 'GroupMember' ) {
            var currGroupMember = {
                type: uwDataProvider.selectedObjects[ i ].object.type,
                uid: uwDataProvider.selectedObjects[ i ].object.uid
            };

            gms[ gmCount ] = currGroupMember;
            gmCount++;
            var userToSelect = uwDataProvider.selectedObjects[ i ].parent.parent.object.uid + '_' + uwDataProvider.selectedObjects[ i ].parent.object.uid;
            gmNodeToSelect.push( userToSelect );
        }

        if( uwDataProvider.selectedObjects[ i ].type === 'Role' ) {
            group = {
                type: uwDataProvider.selectedObjects[ i ].parent.object.objecttype,
                uid: uwDataProvider.selectedObjects[ i ].parent.object.uid
            };

            role = {
                type: uwDataProvider.selectedObjects[ i ].object.type,
                uid: uwDataProvider.selectedObjects[ i ].object.uid
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
        project: context.xrtSummaryContextObject,
        gms: gms,
        groups: groups,
        groupRoles: groupRoles,
        addOrRemove: true
    };
    data.nodes = _.cloneDeep( inputs );
    data.nodes[ 0 ].userParentToSelect = gmNodeToSelect;
    return inputs;
};

/**
 * Load properties to be shown in the tree structure
 * @param {object} data The view model data object
 * @return {object} Output of loadTableProperties
 */
export let loadPropertiesJS = function( data ) {
    var viewModelCollection = data.dataProviders.orgTreeTableDataProvider.getViewModelCollection();
    var loadedVMOs = viewModelCollection.getLoadedViewModelObjects();
    /**
     * Extract action parameters from the arguments to this function.
     */
    var propertyLoadInput = awTableService.findPropertyLoadInput( arguments );

    /**
     * Load the 'child' nodes for the 'parent' node.
     */
    if( propertyLoadInput !== null &&
        propertyLoadInput !== undefined &&
        propertyLoadInput !== 'undefined' ) {
        return awOrganizationTreeUtils.loadTableProperties( propertyLoadInput, loadedVMOs );
    }
};
/**
 * load Properties required to show in tables'
 * @param {Object} propertyLoadInput - Property Load Input
 * @param {Array} loadedVMOs - Loaded View Model Objects
 * @return {Object} propertyLoadResult
 */
export let loadTableProperties = function( propertyLoadInput ) {
    var allChildNodes = [];
    _.forEach( propertyLoadInput.propertyLoadRequests, function( propertyLoadRequest ) {
        _.forEach( propertyLoadRequest.childNodes, function( childNode ) {
            if( !childNode.props ) {
                childNode.props = {};
            }

            if( childNode.id !== 'top' ) {
                allChildNodes.push( childNode );
            }
        } );
    } );

    var propertyLoadResult = awTableService.createPropertyLoadResult( allChildNodes );

    return AwPromiseService.instance.resolve( {
        propertyLoadResult: propertyLoadResult
    } );
};

/**
 * Adds the parent nodes in the context for use when selecting a node in the tree
 * @param {Object} data vmData
 * @param {Object} currentNode current node
 */
var _setParentsInCtx = function( data, currentNode, parents ) {
    data.dataProviders.orgTreeTableDataProvider.viewModelCollection.loadedVMObjects.some( function( VMTN ) {
        if( currentNode.parentID === VMTN.id ) {
            var isExists = false;
            // To avoid data duplication issue, we need to check whether there is a node exists in the ctx.parents
            for( var i = 0; i < parents.length; i++ ) {
                if( parents[ i ].id === VMTN.id && parents[ i ].type === VMTN.type ) {
                    isExists = true;
                }
            }
            if( isExists === false ) {
                parents.unshift( VMTN );
            }

            _setParentsInCtx( data, VMTN, parents );

            return true;
        }
        return false;
    } );
};

/**
 * When a node is expanded, re-set the selection in the org tree to the previously selected node if the selected node is a child of the currently expanding node
 * @param {Object} data vmData
 */
export let preserveSelection = function( data, selectionData ) {
    if( data.selectedTreeNode && data.orgTreeSearchBox.dbValue !== null && data.data.filteringOrgTree ) {
        // parent id must be same, childndx must be right
        if( data.orgTreeInput.treeLoadResult.parentNode.id === data.selectedTreeNode.parentID ) {
            var nodeIndex = _nodeIndex( data.selectedTreeNode.id, data.orgTreeInput.treeLoadResult.childNodes );
            if( nodeIndex !== -1 ) {
                let newSelectionData = { ...selectionData.getValue() };
                newSelectionData.selected = [ data.orgTreeInput.treeLoadResult.childNodes[ nodeIndex ] ];
                selectionData.update( newSelectionData );
                data.dataProviders.orgTreeTableDataProvider.selectionModel.addToSelection( data.orgTreeInput.treeLoadResult.childNodes[ nodeIndex ] );
            } else {
                var orgTreeData = appCtxService.getCtx( 'orgTreeData' );
                let newSelectionData = { ...selectionData.getValue() };
                newSelectionData.selected = [ orgTreeData.Site.node ];
                selectionData.update( newSelectionData );
                data.dataProviders.orgTreeTableDataProvider.selectionModel.addToSelection( orgTreeData.Site.node );
            }
        }
    } else {
        // reset tree states
        if( data.grids ) {
            tableStateService.clearAllStates( data, Object.keys( data.grids )[ 0 ] );
        }

        // select Site in organization tree when the page is initially loaded
        if( data.selectedTreeNode ) {
            let newSelectionData = { ...selectionData.getValue() };
            newSelectionData.selected = [ data.selectedTreeNode ];
            selectionData.update( newSelectionData );
            data.dataProviders.orgTreeTableDataProvider.selectionModel.addToSelection( data.selectedTreeNode );
        } else {
            let newSelectionData = { ...selectionData.getValue() };
            newSelectionData.selected = [ data.orgTreeInput.treeLoadResult.childNodes[ 0 ] ];
            selectionData.update( newSelectionData );
            data.dataProviders.orgTreeTableDataProvider.selectionModel.addToSelection( data.orgTreeInput.treeLoadResult.childNodes[ 0 ] );
        }
    }
};

/**
 * Execute logic for selection steps like selecting\de-selecting the node.
 * @param {Object} data - viewModel
 * @param {Object} ctx - context object
 * @param {Object} currentNode - selected node in org tree
 */
export let treeNodeSelected = function( data, selectedObjects, selectionModelMode, selectionData ) {
    let parents = [];
    if( selectedObjects && selectedObjects.length > 0 && selectionModelMode !== 'multiple' )  {
        //if a node has been selected and it's NOT a deselection, reset the primary workArea
        let parents = [];
        parents.unshift( selectedObjects[ 0 ] );
        _setParentsInCtx( data, selectedObjects[ 0 ], parents );
        let newSelectionData = { ...selectionData.getValue() };
        newSelectionData.selected = [ selectedObjects[ 0 ] ];
        selectionData.update( newSelectionData );
    } else if( selectedObjects && selectedObjects.length > 0 && selectionModelMode === 'multiple' ) {
        let newSelectionData = { ...selectionData.getValue() };
        newSelectionData.selected = selectedObjects;
        selectionData.update( newSelectionData );
    } else if( selectedObjects && selectedObjects.length === 0 ) {
        let newSelectionData = { ...selectionData.getValue() };
        newSelectionData.selected = [];
        selectionData.update( newSelectionData );
    }
    return {
        currentNode: selectedObjects[ 0 ],
        parents: parents
    };
};

/**
 * Toggles the given org tree node as expanded or collapsed
 * @param {Object} node the node to toggle
 * @param {Boolean} isExpanded true/false if the node is expanded or not
 * @param {Object} data vmData
 */
export let expandNode = function( node, isExpanded, data ) {
    if( node === '' ) {
        const treeLoadInput = appCtxService.getCtx( 'treeLoadInput' );
        node = treeLoadInput.rootNode.children[ 0 ];
    }

    node.isExpanded = isExpanded;
    eventBus.publish( 'orgTreeTable12.plTable.toggleTreeNode', node );

    if( data ) {
        return true; // initialExpand
    }
    return false; // initialExpand
};

/**
 *  Get the information from the context hierarchy for the currently expanding node
 * @param {Object} node current node that we are trying to navigate to in orgTreeData
 * @returns {Object} information for the current node from the hierarchy stored in ctx
 */
var _getParentNodeInHierarchy = function( node ) {
    // get an array of parent Ids to iterate through the hierarchy; takes into account possible subgroups

    //NOTE: node.hierarchy provides the order for traversing the org tree
    //Ex: Site.Group1.Subgroup1.Role1
    const orgTreeData = appCtxService.getCtx( 'orgTreeData' );
    var hierarchy = [];
    if( node.hierarchy ) {
        hierarchy = node.hierarchy.split( '.' );
    }
    var id = 'Site';
    var currNode = orgTreeData.Site;
    for( var i = 1; i < hierarchy.length; i++ ) {
        id += '.' + hierarchy[ i ];
        currNode = currNode.hier[ id ];
    }
    //return the relevant node based on the parent id for the expanding node
    return currNode;
};

/**
 * Generate unique Id for org tree node
 * @param {String} parentName name of parent for current node
 * @param {String} childName full name of current node
 * @return {String} unique ID for node in org tree
 */
var generateID = function( parentName, childName ) {
    return 'org-tree-' + parentName + '-' + childName;
};

/**
 * Adds a group to the hier and children for parentNode
 * @param {Object} parentNode node that we are adding the group to
 * @param {String} groupName name of the group we are adding to parentNode
 * @param {Object} orgObject object containing the group information
 * @param {Number} index index of the new node
 * @param {Object} groupsToAdd subgroups that still need to be added
 * @returns {Object} the updated node and parent from orgTreeData
 */
var _addGroupToHierarchy = function( parentNode, groupName, orgObject, index, groupsToAdd ) {
    // create and add vmNode to orgTreeData
    var vmNode = _createViewModelTreeNode( orgObject.group, parentNode.node.levelNdx + 1, //
        index, parentNode.node.dbValue, parentNode.node.id, parentNode.node.fullName, parentNode.node.hierarchy,
        parentNode.node );

    var parent = parentNode.hier[ vmNode.hierarchy ];
    if( _.isUndefined( parent ) ) {
        parent = _getInitialObject( vmNode );
    }

    var node = vmNode;
    var par = parent;
    // recursively add all children from groupsToAdd that are relevant to this level in the hierarchy
    // (i.e. each time a subgroup is added, check groupsToAdd to see if there are subgroups for that subgroup to add, etc.)
    while( !_.isNull( node ) ) {
        var newData = _addSubgroupsToHierarchy( par, node, groupsToAdd );
        node = newData.vmNode;
        par = newData.parent;
    }

    return {
        vmNode: vmNode,
        parent: parent
    };
};

/**
 * Goes through groupsToAdd and adds all of the subgroups to vmNode
 * @param {Object} parent parent node we are adding subgroups to
 * @param {Object} vmNode node data for the node we are adding subgroups to
 * @param {Object} groupsToAdd the subgroups that still need to be added to a group or subgroup
 * @returns {Object} the next childNode to add subgroups to and the hierarchy for that childNode from orgTreeData
 */
var _addSubgroupsToHierarchy = function( parent, vmNode, groupsToAdd ) {
    // Check groupsToAdd to see if we need to add its children to orgTreeData
    if( !groupsToAdd.hasOwnProperty( vmNode.fullName ) ) {
        return {
            vmNode: null,
            parent: null
        };
    }
    var children = groupsToAdd[ vmNode.fullName ];
    var childNode;
    for( var i = 0; i < children.length; i++ ) {
        childNode = _createViewModelTreeNode( children[ i ].group, vmNode.levelNdx + 1, i, vmNode.dbValue, vmNode.id, vmNode.fullName, vmNode.hierarchy,
            vmNode.node );

        // add to children and hier for parent in orgTreeData
        parent.children.push( childNode );
        parent.hier[ childNode.hierarchy ] = _getInitialObject( childNode );
    }
    return {
        vmNode: childNode,
        parent: parent.hier[ childNode.hierarchy ]
    };
};

/**
 * On page load, this method builds the root Site node for the org tree
 * @param {Object} treeLoadInput input for the tree creation
 */
var _buildOrgLevelTreeStructure = function( treeLoadInput ) {
    var children1 = [];
    var localTextBundle = localeService.getLoadedText( 'OrganizationMessages' );
    var children = [ {
        id: 'SiteLevel',
        displayValue: localTextBundle.Organization,
        type: 'Site',
        location: 'Site'
    } ];

    var fullHierarchy = {};
    var tempCursorObject = {
        endReached: true,
        startReached: true
    };

    fullHierarchy.children = children;
    const ctxTreeLoadInput = appCtxService.getCtx( 'treeLoadInput' );

    var vmNode = awTableService.createViewModelTreeNode(
        children[ 0 ].id, children[ 0 ].type,
        children[ 0 ].displayValue, treeLoadInput.parentNode.levelNdx + 1, 0,
        '' );

    vmNode.iconURL = iconService.getTypeIconURL( 'ProjectTeam' );
    vmNode.parentID = ctxTreeLoadInput.parentNode.id;
    vmNode.parentName = ctxTreeLoadInput.parentNode.displayName;
    vmNode.parent = ctxTreeLoadInput.parentNode;
    vmNode.hierarchy = children[ 0 ].type;
    vmNode.fullName = children[ 0 ].displayValue;
    vmNode.dbvalue = 'Organization';

    children1.push( vmNode );

    var rootPathNodes = [];

    var vmNode1 = awTableService.createViewModelTreeNode(
        ctxTreeLoadInput.parentNode.id, '',
        ctxTreeLoadInput.parentNode.className, -1, 0, null );

    rootPathNodes.push( vmNode1 );

    let newCtxTreeLoadInput = { ...ctxTreeLoadInput };
    newCtxTreeLoadInput.pageSize = children1.length;
    appCtxService.updateCtx( 'treeLoadInput', newCtxTreeLoadInput );
    //ctx.treeLoadInput.pageSize = children1.length;
    var treeLoadResult = awTableService.buildTreeLoadResult(
        newCtxTreeLoadInput, children1, false, true, true, null );

    treeLoadResult.rootPathNodes = rootPathNodes;

    treeLoadResult.parentNode.cursorObject = tempCursorObject;

    // Add the first level to the ctx for storing the tree hierarchy
    //test
    let orgTreeData = {};
    orgTreeData[ children1[ 0 ].type ] = {
        children: [],
        hier: {},
        fullExpansion: false,
        node: children1[ 0 ]
    };
    appCtxService.registerCtx( 'orgTreeData', orgTreeData );

    return {
        treeLoadResult: treeLoadResult
    };
};

/**
 * When the Site node expands, this method retrieves the first level of the org tree (the groups) to display, and adds any subgroups to the orgTreeData

 * @param {Object} treeLoadInput input for the tree creation
 * @param {Object} expandingNode node that is currently expanding from ctx.orgTreeData
 * @returns {Promise} resolved promise
 */
var _buildGroupsAndSubgroups = function( treeLoadInput, expandingNode, data ) {
    var children = expandingNode.children;
    const ctxOrgTreeData = appCtxService.getCtx( 'orgTreeData' );
    const ctxTreeLoadInput = appCtxService.getCtx( 'treeLoadInput' );
    let newCtxTreeLoadInput = { ...ctxTreeLoadInput };
    let newCtxOrgTreeData = { ...ctxOrgTreeData };
    // if the children of the currently expanding node have already been loaded and we are filtering the table OR all of the children for the
    // expanding node have already been retrieved from the SOA, then use the treeNodes that have already been created and stored in ctx
    if( !_.isUndefined( children ) && children.length > 0 && ( data.data.filteringOrgTree === true || //
            expandingNode.fullExpansion === true ) ) {
        var tempCursorObject = {
            endReached: true,
            startReached: true
        };
        var rootPathNodes = [];

        newCtxTreeLoadInput.pageSize = ctxOrgTreeData[ treeLoadInput.parentNode.hierarchy ].children.length;

        // mark the children as not expanded and the children as empty so that the built-in expansion handling will correctly happen
        newCtxOrgTreeData[ treeLoadInput.parentNode.hierarchy ].children.forEach( function( child ) {
            child.isExpanded = false;
            child.children = [];
            if( expandingNode.fullExpansion === true ) {
                child.isLeaf = false;
            }
        } );
        appCtxService.updateCtx( 'treeLoadInput', newCtxTreeLoadInput );
        appCtxService.updateCtx( 'orgTreeData', newCtxOrgTreeData );
        var treeLoadResult = awTableService.buildTreeLoadResult( newCtxTreeLoadInput, newCtxOrgTreeData[ treeLoadInput.parentNode.hierarchy ].children, false, true, true, null );

        treeLoadResult.rootPathNodes = rootPathNodes;
        treeLoadResult.parentNode.cursorObject = tempCursorObject;
        return {
            treeLoadResult: treeLoadResult
        };
    }
    var getOrgInput = {
        options: [ {
            groupName: '',
            onlyFirstLevelSubGroups: false,
            includeRoleInGroupInfo: false,
            includeUsersInGroupRoleInfo: false
        } ]
    };

    var policyId = propertyPolicySvc.register( {
        types: [ {
            name: 'Group',
            properties: [ {
                name: 'name'
            } ]
        },
        {
            name: 'Role',
            properties: [ {
                name: 'role_name'
            } ]
        }
        ]
    } );

    // SOA call to get Root Level groups
    return soaService.postUnchecked( 'Internal-Core-2007-01-DataManagement', 'getOrganizationInformation', //
        { options: getOrgInput.options }, policyIOverride )
        .then( function( response ) {
            propertyPolicySvc.unregister( policyId );
            // handle the error
            var err = handleSOAResponseError( response.ServiceData );
            if( !_.isUndefined( err ) ) {
                return getRejectionPromise( err );
            }
            var children = response.hierDataMap[ 1 ];
            var rootGroups = [];
            var childGroups = [];
            var fullHierarchy = {};
            var tempCursorObject = {
                endReached: true,
                startReached: true
            };

            fullHierarchy.children = response.rootLevelGroups;

            newCtxOrgTreeData[ treeLoadInput.parentNode.hierarchy ] = _getInitialObject( treeLoadInput.parentNode );
            appCtxService.updateCtx( 'orgTreeData', newCtxOrgTreeData );
            var groupsToAdd = {};

            var noOfGroups = children.length;
            for( var i = 0; i < noOfGroups - 1; i++ ) {
                for( var j = 0; j < noOfGroups - i - 1; j++ ) {
                    var currentGroupLen = children[ j ].group.props.object_string.dbValues[ 0 ].split( '.' ).length;
                    var nextGroupLen = children[ j + 1 ].group.props.object_string.dbValues[ 0 ].split( '.' ).length;

                    if( currentGroupLen > nextGroupLen ) {
                        var temp = children[ j ];
                        children[ j ] = children[ j + 1 ];
                        children[ j + 1 ] = temp;
                    }
                }
            }

            for( var i = 0; i < children.length; i++ ) {
                if( children[ i ].parent.className === 'unknownClass' ) {
                    rootGroups.push( children[ i ] );
                } else {
                    childGroups.push( children[ i ] );
                }
            }
            for( var i = 0; i < rootGroups.length; i++ ) {
                var vmNode;
                var parent;
                var data;
                var index = children.length - 1;
                if( rootGroups[ i ].parent.className === 'unknownClass' ) {
                    // child node is one of the first level nodes, so add it to the hierarchy
                    data = _addGroupToHierarchy( newCtxOrgTreeData.Site, rootGroups[ i ].group.props.object_string.dbValues[ 0 ], //
                        rootGroups[ i ], index, groupsToAdd );
                    vmNode = data.vmNode;
                    parent = data.parent;

                    // add node to orgTreeData.Site
                    newCtxOrgTreeData.Site.children.push( vmNode );
                    newCtxOrgTreeData.Site.hier[ vmNode.hierarchy ] = parent;
                    appCtxService.updateCtx( 'orgTreeData', newCtxOrgTreeData );
                }
            }

            for( var i = 0; i < childGroups.length; i++ ) {
                var vmNode;
                var parent;
                var data;
                var index = children.length - 1;

                // this is a subgroup
                var subgroupName = childGroups[ i ].group.props.object_string.dbValues[ 0 ];
                var groups = subgroupName.split( '.' );
                var ndx = groups.length - 1;
                var parentNode = newCtxOrgTreeData.Site;
                var id = 'Site';

                //navigate to the parent of the node we want to add
                while( ndx > 0 && !_.isUndefined( parentNode ) ) {
                    id += '.' + groups[ ndx ] + '_Group';
                    parentNode = parentNode.hier[ id ];
                    ndx--;
                }

                // if the parent hasn't been added to the orgTreeData yet, store it in groupsToAdd until the parent is added
                if( _.isUndefined( parentNode ) ) {
                    var parentId = subgroupName.substring( subgroupName.indexOf( '.' ) + 1 );
                    if( _.isUndefined( groupsToAdd[ parentId ] ) ) {
                        groupsToAdd[ parentId ] = [];
                    }
                    groupsToAdd[ parentId ].push( childGroups[ i ] );
                } else {
                    // parent already exists, so add the subgroup to the hierarchy
                    data = _addGroupToHierarchy( parentNode, subgroupName, childGroups[ i ], index, groupsToAdd );
                    vmNode = data.vmNode;
                    parent = data.parent;

                    // add the node to the orgTreeData and the parent's list of children
                    parentNode.hier[ vmNode.hierarchy ] = parent;
                    parentNode.children.push( vmNode );
                }
            }

            newCtxOrgTreeData.Site.fullExpansion = true;

            // alphabetize children by displayName
            newCtxOrgTreeData.Site.children = _.sortBy( newCtxOrgTreeData.Site.children, [ 'displayName' ] );
            newCtxOrgTreeData.Site.children.forEach( function( element, index ) {
                element.childNdx = index;
                element.isLeaf = false;
            } );

            var rootPathNodes = [];
            newCtxTreeLoadInput.pageSize = newCtxOrgTreeData.Site.children.length;
            appCtxService.updateCtx( 'treeLoadInput', newCtxTreeLoadInput );
            appCtxService.updateCtx( 'orgTreeData', newCtxOrgTreeData );
            var treeLoadResult = awTableService.buildTreeLoadResult(
                newCtxTreeLoadInput, newCtxOrgTreeData.Site.children, false, true, true, null );

            treeLoadResult.rootPathNodes = rootPathNodes;

            treeLoadResult.parentNode.cursorObject = tempCursorObject;

            return {
                treeLoadResult: treeLoadResult
            };
        }, function( err ) {
            throw err;
        } );
};

var showHideInactiveGroupMembers = function() {
    soaService.postUnchecked( 'Administration-2012-09-PreferenceManagement', 'getPreferences', {
        preferenceNames: [ 'TC_suppress_inactive_group_members' ],
        includePreferenceDescriptions: false
    } ).then(
        function( result ) {
            if( result ) {
                if( result.response[ 0 ].values.values.length > 0 && result.response[ 0 ].values.values[ 0 ] !== '' ) {
                    if( result.response[ 0 ].values.values[ 0 ] === '0' ) {
                        showInactive = true;
                    }
                }
            }
        }
    );
};

/**
 * When any node other than the Site or first level group node expands, this method retrieves the children of that node (subgroups, roles, or users)
 * @param {Object} deferred promise to be resolved after creating the treeLoadResult
 * @param {Object} treeLoadInput input for the tree creation
 * @param {Object} ctx context
 * @param {Object} expandingNode node that is currently expanding from ctx.orgTreeData
 *
 * @returns {Promise} resolved promise
 */
var _buildRoleAndUserTreeStructure = function( treeLoadInput, expandingNode, data ) {
    var children = expandingNode.children;
    const ctxTreeLoadInput = appCtxService.getCtx( 'treeLoadInput' );
    const ctxOrgTreeData = appCtxService.getCtx( 'orgTreeData' );
    let newCtxOrgTreeData = { ...ctxOrgTreeData };
    let newCtxTreeLoadInput = { ...ctxTreeLoadInput };
    // if the children of the currently expanding node have already been loaded and we are filtering the table OR all of the children for the
    // expanding node have already been retrieved from the SOA, then use the treeNodes that have already been created and stored in ctx
    if( !_.isUndefined( children ) && children.length > 0 && ( data.data.filteringOrgTree === true || //
            expandingNode.fullExpansion === true ) ) {
        var tempCursorObject = {
            endReached: true,
            startReached: true
        };
        var rootPathNodes = [];

        newCtxTreeLoadInput.pageSize = children.length;
        appCtxService.updateCtx( 'treeLoadInput', newCtxTreeLoadInput );
        // mark the children as not expanded and the children as empty so that the built-in expansion handling will correctly happen
        children.forEach( function( child ) {
            child.isExpanded = false;
            child.children = [];

            if( expandingNode.fullExpansion === true && child.type !== 'GroupMember' ) {
                child.isLeaf = false;
            }
        } );

        var treeLoadResult = awTableService.buildTreeLoadResult( newCtxTreeLoadInput, children, false, true, true, null );

        treeLoadResult.rootPathNodes = rootPathNodes;
        treeLoadResult.parentNode.cursorObject = tempCursorObject;
        return {
            treeLoadResult: treeLoadResult
        };
    }
    // even if subgroups exist for this group already, we need to get the roles as well if there are any
    var userID = '*';
    var userName = '*';
    var groupName = '*';
    var roleName = '*';

    if( treeLoadInput.parentNode.type === 'Group' ) {
        groupName = treeLoadInput.parentNode.dbValue;
    } else if( treeLoadInput.parentNode.type === 'Role' ) {
        roleName = treeLoadInput.parentNode.dbValue;
        groupName = treeLoadInput.parentNode.parentName;
    }

    var getOrgGroupMembersInput = {
        input: {
            userID: userID,
            userName: userName,
            groupName: groupName,
            roleName: roleName,
            includeInactive: showInactive,
            includeSubGroups: true
        }
    };

    // SOA call to get Children Information
    return soaService.postUnchecked( 'Internal-Administration-2012-10-OrganizationManagement', 'getOrganizationGroupMembers', //
        { input: getOrgGroupMembersInput.input }, policyIOverride )
        .then( function( response ) {
            // handle the error
            var err = handleSOAResponseError( response.ServiceData );
            if( !_.isUndefined( err ) ) {
                return getRejectionPromise( err );
            }

            // parse through roles for the expanded group
            var children = [];

            // Change this so that we are always getting the roles
            //We should only do this if groupElementMap has something in it.
            if( response.groupElementMap ) {
                var groupMap = response.groupElementMap[ 1 ];
                for( var i = 0; i < groupMap.length; i++ ) {
                    var groupInMap = groupMap[ i ];
                    if( treeLoadInput.parentNode.type === 'Group' ) {
                        expandedGroupNodes[ grpCount ] = treeLoadInput.parentNode;
                        grpCount++;

                        if( groupInMap.group.props.object_string.dbValues[ 0 ] === treeLoadInput.parentNode.fullName ) {
                            // groupInMap is the expanded group itself, so add the roles to children
                            children = children.concat( groupInMap.roles );
                        }
                    } else if( treeLoadInput.parentNode.type === 'Role' ) {
                        // role is expanding, so add the users to children
                        children = groupInMap.members[ 0 ].members;
                    }
                }
            }

            var fullHierarchy = {};
            var tempCursorObject = {
                endReached: true,
                startReached: true
            };

            fullHierarchy.children = _.cloneDeep( children );

            for( var j = 0; j < children.length; j++ ) {
                var id = generateID( newCtxTreeLoadInput.parentNode.fullName, children[ j ].type === 'Role' ? children[ j ].props.object_string.dbValues[ 0 ] : children[ j ].props.user.uiValues[
                    0 ] );
                if( !_.some( expandingNode.children, [ 'id', id ] ) ) {
                    var vmNode = _createViewModelTreeNode( children[ j ], newCtxTreeLoadInput.parentNode.levelNdx + 1, j, newCtxTreeLoadInput.parentNode.dbValue, //
                        newCtxTreeLoadInput.parentNode.id, newCtxTreeLoadInput.parentNode.fullName, newCtxTreeLoadInput.parentNode.hierarchy,
                        newCtxTreeLoadInput.parentNode );

                    expandingNode.children.push( vmNode );
                    expandingNode.hier[ treeLoadInput.parentNode.hierarchy + '.' + vmNode.displayName + '_' + vmNode.type ] = _getInitialObject( vmNode );
                }
            }

            expandingNode.fullExpansion = true;

            // Sub-Groups should appear before Roles in Organization tree.
            // Reorder children so that sub-groups appear before roles, only needs to be done if the expanded
            // node is of type Group (only groups can have sub-groups and roles)
            if( treeLoadInput.parentNode.type === 'Group' ) {
                expandingNode.children = _.sortBy( expandingNode.children, [ 'type', 'displayName' ] );
            } else {
                expandingNode.children = _.sortBy( expandingNode.children, [ 'displayName' ] );
            }
            expandingNode.children.forEach( function( element, index ) {
                element.childNdx = index;
                element.isExpanded = false;
                element.children = [];

                if( element.type !== 'GroupMember' ) {
                    element.isLeaf = false;
                }
            } );

            var rootPathNodes = [];
            newCtxTreeLoadInput.pageSize = expandingNode.children.length;
            appCtxService.updateCtx( 'treeLoadInput', newCtxTreeLoadInput );
            var treeLoadResult = awTableService.buildTreeLoadResult(
                newCtxTreeLoadInput, expandingNode.children, false, true, true, null );

            treeLoadResult.rootPathNodes = rootPathNodes;

            treeLoadResult.parentNode.cursorObject = tempCursorObject;

            // set the new data in the context for the expanding node
            newCtxOrgTreeData = _setParentNodeInHierarchy( treeLoadInput.parentNode, ctxOrgTreeData, expandingNode );
            appCtxService.updateCtx( 'orgTreeData', newCtxOrgTreeData );
            return {
                treeLoadResult: treeLoadResult
            };
        }, function( err ) {
            throw err;
        } );
};

/**
 * Private function
 * Calls SOA and handles the response
 * @param {*} treeLoadInput Tree load input
 */
function _buildTreeTableStructure( treeLoadInput, data ) {
    var expandingNode;

    if( treeLoadInput.parentNode.levelNdx === -1 ) {
        return _buildOrgLevelTreeStructure( treeLoadInput );
    } else if( treeLoadInput.parentNode.levelNdx === 0 ) {
        // Get the parent node from the context if it is available
        expandingNode = _getParentNodeInHierarchy( treeLoadInput.parentNode );
        // This means that the Site node is expanding, so show the groups
        return _buildGroupsAndSubgroups( treeLoadInput, expandingNode, data );
    }
    // Get the parent node from the context if it is available
    expandingNode = _getParentNodeInHierarchy( treeLoadInput.parentNode );
    // Otherwise, this means that another level has been expanded and we need to show the subgroups/roles/and or users
    showHideInactiveGroupMembers();
    return _buildRoleAndUserTreeStructure( treeLoadInput, expandingNode, data );
}

/**
 * We are using below function when tree needs to be created . Same function will be used in both initialize and next action mode.
 * We need to use it for expanding the tree as well.
 * @param {Object} ctx context

 * @return {Promise} Resolved with an object containing the results of the operation.
 */
export let getTreeStructure = function( treeLoadInput, data ) {
    var _treeLoadInput = awTableService.findTreeLoadInput( arguments );
    var deferred = AwPromiseService.instance.defer();
    if( !_.isUndefined( _treeLoadInput ) ) {
        _treeLoadInput.displayMode = 'Tree';
        appCtxService.registerCtx( 'treeLoadInput', _treeLoadInput );
        var failureReason = awTableService
            .validateTreeLoadInput( _treeLoadInput );

        if( failureReason ) {
            deferred.reject( failureReason );

            return deferred.promise;
        }

        return _buildTreeTableStructure( _treeLoadInput, data );
    }
    deferred.resolve();
    return deferred.promise;
};

/**
 * Return Object of node with uid and type
 *
 * @param {Object} node tree node
 *
 * @returns {Object} node object
 */
var _getObject = function( node ) {
    var uid = null;
    var type = null;
    uid = node.uid;
    type = node.type;
    return { uid: uid, type: type };
};

/**
 * Creates a new viewModelTreeNode given the appropriate data
 * @param {Object} viewModelData input to create the viewModelTreeNode
 *
 * @returns {Object} vmNode - the newly created viewModelTreeNode
 */
var _createViewModelTreeNode = function( orgObject, levelNdx, childNdx, parentDisplayName, parentId, parentFullName, parentHierarchy, parentNode ) {
    //displayName, fullName, icon, hierarchy, object;
    var displayName = orgObject.type === 'Site' ? orgObject.name : orgObject.type === 'Group' ? orgObject.props.object_string.dbValues[ 0 ].split( '.' )[ 0 ] : //
        orgObject.type === 'Role' ? orgObject.props.object_string.dbValues[ 0 ] : orgObject.props.user.uiValues[ 0 ];
    var id = orgObject.type !== 'Site' ? generateID( parentFullName, displayName ) : orgObject.type;

    var vmNode = awTableService.createViewModelTreeNode( id, orgObject.type, displayName, levelNdx, childNdx, '' );

    if( orgObject.type === 'GroupMember' ) {
        vmNode.isLeaf = true;
    }
    vmNode.iconURL = orgObject.type === 'Group' || orgObject.type === 'Site' ? iconService.getTypeIconURL( 'ProjectTeam' ) : //
        orgObject.type === 'Role' ? iconService.getTypeIconURL( 'Role' ) : iconService.getTypeIconURL( 'Person' );
    vmNode.parentID = parentId;
    vmNode.parentName = parentDisplayName;
    vmNode.parent = parentNode;
    vmNode.fullName = orgObject.type !== 'GroupMember' ? orgObject.type === 'Site' ? orgObject.name : orgObject.props.object_string.dbValues[ 0 ] : orgObject.props.user.uiValues[ 0 ];
    vmNode.hierarchy = orgObject.type !== 'Site' ? parentHierarchy + '.' + displayName + '_' + orgObject.type : orgObject.type;
    vmNode.object = _getObject( orgObject );
    vmNode.isExpanded = false;
    if( !vmNode.props ) {
        vmNode.props = {};
        // Create property 'Test'
        var vmProp = null;
        vmProp = uwPropertySvc.createViewModelProperty( 'Test', 'Test',
            'STRING', '', '' );
        vmNode.props.Test = vmProp;
    }
    if( orgObject.type === 'Group' && orgObject.props.name ) {
        vmNode.dbValue = orgObject.props.name.dbValues[ 0 ];
    } else if( orgObject.type === 'Role' && orgObject.props.role_name ) {
        vmNode.dbValue = orgObject.props.role_name.dbValues[ 0 ];
    } else // incase of GroupMember or Site
    {
        vmNode.dbValue = vmNode.displayName;
    }

    return vmNode;
};

/**
 * Adds the group, role, or user to the orgTreeData if it has not already been added. Also updates which nodes need to be expanded based on the filterString
 * @param {Object} groupMember the groupMember returned from the server containing all information about users, role, and group
 * @param {Object} orgTreeData object containing the currently loaded hierarchy for the org tree
 * @param {Number} groupMemberNdx number indicating which User to insert into the org tree
 * @param {Object} filterData search data containing the seach information that the user entered to filter the org tree
 * @param {Object} vmData view model data
 * @param {String} gridId name of the org tree in the viewmodel
 * @returns {Object} the new orgTreeData with added information
 */
export let filterGroupMembersInOrgTree = function( groupMember, orgTreeData, groupMemberNdx, filterData, vmData, gridId, selectedNode, selectedNodeFound ) {
    /**
     * The objective of this method is to make sure all parts of the org tree for each of the groupmembers returned from the
     * org tree filtering have been loaded into the ctx.
     */

    /**
     * Split the group name on '.'. A group will have a '.' in the name if it is a subgroup of another group. (Ex: 'Subgroup2.Subgroup1.Group1' )
     * indicates that the group name is Subgroup2 and that it is a subgroup of Subgroup1, which is in turn a subgroup of Group1
     */
    var _groupObj = groupMember.group;
    var _groups = _groupObj.props.object_string.dbValues[ 0 ].split( '.' );
    var _roleObj = groupMember.role;
    var _userObj = groupMember.groupMembers[ groupMemberNdx ];

    // lowest node in the hierarchy that contains the search string
    var lowestFoundName = !_.isUndefined( filterData.username ) && filterData.username.test( awOrganizationTreeUtils.getUserName( _userObj.props.user.uiValues[ 0 ] ) ) || //
        !_.isUndefined( filterData.userid ) && filterData.userid.test( awOrganizationTreeUtils.getUserId( _userObj.props.user.uiValues[ 0 ] ) ) ? _userObj.props.user.uiValues[ 0 ] : //
        !_.isUndefined( filterData.role ) && filterData.role.test( _roleObj.props.object_string.dbValues[ 0 ] ) ? _roleObj.props.object_string.dbValues[ 0 ] : //
            !_.isUndefined( filterData.group ) && filterData.group.test( _groupObj.props.object_string.dbValues[ 0 ] ) ? _groupObj.props.object_string.dbValues[ 0 ] : null;

    if( lowestFoundName !== null ) {
        // org tree data that we will use to assemble group hierarchy
        var prevOrgTreeData = appCtxService.getCtx( 'prevOrgTreeData' );

        // current node being examined and initialized if necessary
        var currNode = orgTreeData.Site;

        // previous node to add the current node to if applicable
        var prevNode;

        // index for the group/subgroup we are adding
        var ndx = _groups.length - 1;

        // data containing all of the group/subgroup data that we will be pulling from to add groups to the org tree
        var prevOrgTreeDataNode = prevOrgTreeData.Site;

        // id to be used to grab data from orgTreeData
        var id = 'Site';

        // while the current node is not the lowest in this branch of the hierarchy, add the correct nodes to the orgTreeData
        while( currNode.node.fullName !== lowestFoundName ) {
            prevNode = currNode;
            if( ndx >= 0 ) {
                // for groups and subgroups, get the data from the previous org tree, rather than creating new nodes
                // this ensures all groups and subgroups are present
                id += '.' + _groups[ ndx ] + '_' + _groupObj.type;
                currNode = currNode.hier[ id ];
                prevOrgTreeDataNode = prevOrgTreeDataNode.hier[ id ];

                if( _.isUndefined( currNode ) ) {
                    // add the group from the previous org tree data

                    if( _.isUndefined( prevOrgTreeDataNode ) ) {
                        currNode = _getInitialObject( prevOrgTreeData.Site.node );
                    } else {
                        currNode = _getInitialObject( prevOrgTreeDataNode.node );
                    }

                    if( _.isUndefined( prevOrgTreeDataNode ) ) {
                        prevNode.hier[ prevOrgTreeData.Site.node.hierarchy ] = currNode;
                        prevNode.children.push( prevOrgTreeData.Site.node );
                    } else {
                        prevNode.hier[ prevOrgTreeDataNode.node.hierarchy ] = currNode;
                        prevNode.children.push( prevOrgTreeDataNode.node );
                    }
                }
                ndx--;
            } else {
                // create new node if it doesn't exist already and add to prevNode children and hierarchy
                var nodeObj = prevNode.node.type === 'Group' ? _roleObj : _userObj;
                id += '.' + ( nodeObj.type === 'Role' ? nodeObj.props.object_string.dbValues[ 0 ] : _userObj.props.user.uiValues[ 0 ] ) + '_' + nodeObj.type;
                currNode = currNode.hier[ id ];
                if( _.isUndefined( currNode ) ) {
                    var vmNode = _createViewModelTreeNode( nodeObj, prevNode.node.levelNdx + 1, prevNode.children.length, prevNode.node.displayName, prevNode.node.id, //
                        prevNode.node.fullName, prevNode.node.hierarchy, prevNode.node );

                    // initialize object for new node
                    currNode = _getInitialObject( vmNode );

                    // Add the new node and it's data to the hierarchy and children of the parent in the tree
                    prevNode.hier[ vmNode.hierarchy ] = currNode;
                    prevNode.children.push( vmNode );
                    prevNode.node.isLeaf = false;
                }
            }

            // if current node is the selected node, set selectedNodeFound to true
            if( currNode.node.id === selectedNode.id ) {
                selectedNodeFound = true;
            }

            // ensure nodes are in alphabetical order
            if( prevNode.children.length > 0 ) {
                prevNode.children = _.sortBy( prevNode.children, [ 'displayName' ] );
                prevNode.children.forEach( function( element, index ) {
                    element.childNdx = index;
                } );

                // make sure the previous node is not marked as a leaf
                prevNode.node.isLeaf = false;
            }
        }

        // currNode now represents the lowest level in orgTreeData for this user that contains the filter string
        // set the lowest node to a leaf
        currNode.node.isLeaf = true;

        /**
         * Expand nodes from Site down to the lowest node relevant to the search criteria
         */
        _setNodesToExpand( currNode.node, _groups, _roleObj.props.object_string.dbValues[ 0 ], _userObj.props.user.uiValues[ 0 ], orgTreeData, vmData, gridId );
    }

    return {
        orgTreeData: orgTreeData,
        selectedNodeFound: selectedNodeFound
    };
};

/**
 * Show message that there are no results found.
 * @param {Object} filterString the search string for the org tree.
 */
var _showNoResultsMessage = function( filterString ) {
    var localTextBundle = localeService.getLoadedText( 'OrganizationMessages' );
    var msg = localTextBundle.noOrgTreeResultsFound;
    msg = msg.replace( '{0}', filterString );
    msgService.showInfo( msg );
};

/**
 * Show usage message.
 */
var _showUsageMessage = function( filterString ) {
    var localTextBundle = localeService.getLoadedText( 'OrganizationMessages' );
    var orgMsg = localTextBundle.orgFilterUsage;
    orgMsg = orgMsg.replace( '{0}', 'username' );
    orgMsg = orgMsg.replace( '{1}', 'group, role, username' );
    orgMsg = orgMsg.replace( '{2}', 'userid' );

    var advancedSearchMsg = localTextBundle.advancedSearchMessage;
    advancedSearchMsg = advancedSearchMsg.replace( '{0}', orgMsg );

    var escapeCharsMsg = localTextBundle.orgEscapeChars;
    escapeCharsMsg = escapeCharsMsg.replace( '{0}', advancedSearchMsg );

    var msg = localTextBundle.usageMessage;
    msg = msg.replace( '{0}', filterString );
    msg = msg.replace( '{1}', escapeCharsMsg );
    msgService.showInfo( msg );
};

/**
 * Recursively navigates through org tree groups and subgroups to determine which groups and subgroups to add based on the groupRegEx
 * @param {Object} parent parent of the current node
 * @param {Object} currNode current group or subgroup being examined
 * @param {Object} lowest_found the current lowest level group node that contains the group regular expression
 * @param {RegExp} groupRegEx the generated regular expression for the group based on the filter string from the user
 * @param {Boolean} addNode indicates whether the node should be added to orgTreeData
 * @param {Object} selectedNode current selected node in the org tree
 * @param {Boolean} selectedNodeFound indicates if the current selected node is still visible in the org tree after filtering
 * @returns {Object} the current node being examined, lowest_found, addNode, and selectedNodeFound
 */
var _filterGroups = function( parent, currNode, lowest_found, groupRegEx, addNode, selectedNode, selectedNodeFound ) {
    if( currNode.node.type !== 'Group' ) {
        return {
            currNode: null,
            lowest_found: lowest_found,
            addNode: false,
            selectedNodeFound: selectedNodeFound
        };
    }

    // determine if the current group/subgroup node in orgTreeData meets the group filter criteria
    if( groupRegEx.test( currNode.node.displayName ) ) {
        lowest_found = currNode.node;
        addNode = true;
    }

    // check if the current node is the selected node
    if( currNode.node.id === selectedNode.id ) {
        selectedNodeFound = true;
    }

    var node = _getInitialObject( currNode.node );
    var childrenKeys = Object.keys( currNode.hier );
    for( var i = 0; i < childrenKeys.length; i++ ) {
        var data = _filterGroups( currNode, currNode.hier[ childrenKeys[ i ] ], lowest_found, groupRegEx, false, selectedNode, selectedNodeFound );
        if( data.addNode ) {
            node.children.push( data.currNode.node );
            node.hier[ data.currNode.node.hierarchy ] = data.currNode;
            addNode = data.addNode;
            lowest_found = data.lowest_found;
            selectedNodeFound = data.selectedNodeFound;
        }
    }

    if( node.children.length !== 0 ) {
        node.children = _.sortBy( node.children, [ 'displayName' ] );
        node.children.forEach( function( element, index ) {
            element.childNdx = index;
        } );
        node.node.isLeaf = false;
    } else {
        node.node.isLeaf = true;
    }

    return {
        currNode: node,
        lowest_found: lowest_found,
        addNode: addNode,
        selectedNodeFound: selectedNodeFound
    };
};

var _getInputFromFilterString = function( filterString, escapeDoubleQuote, unescapedDoubleQuote ) {
    var inputFromFilterString = {};
    var isValidInput = true;
    while( filterString.length > 0 && isValidInput === true ) {
        // MUST start with group:/role:/username:/userid:
        var beginningOfString = /^\s*(group:|username:|userid:|role:)/i;
        var validBeginning = beginningOfString.test( filterString );
        if( validBeginning === false ) {
            // invalid input, either group:/role:/username:/userid: must be present
            // takes care of case like group: test test role:tester, where quotes are not around
            // string with a space in it
            isValidInput = false;
        }

        // if group:/role:/username:/userid: is followed by ", then get anything inside " "
        // else, get everything up until the next space
        var field = filterString.substring( 0, filterString.indexOf( ':' ) ).trim().toLowerCase();
        filterString = filterString.substring( filterString.indexOf( ':' ) + 1 ).trim();
        var value;
        if( filterString.charAt( 0 ) === '"' ) {
            // advanced case with " " case
            value = filterString.match( /\"(.*?)[^\\]\"/ );
            value = !_.isNull( value ) ? value[ 0 ] : '';
            filterString = filterString.substring( value.length + 1 ).trim();
            value = value.replace( escapeDoubleQuote, '"' );
        } else {
            value = filterString.match( /\s*(.*?\s|.*)/ )[ 1 ].trim();

            if( _.includes( value, ':' ) || unescapedDoubleQuote.test( value ) ) {
                // invalid input, string with : must be surrounded by " " and " must be escaped
                isValidInput = false;
            }

            value = value.replace( escapeDoubleQuote, '"' );
            filterString = filterString.substring( filterString.indexOf( ' ' ) !== -1 ? //
                filterString.indexOf( ' ' ) + 1 : filterString.length + 1 ).trim();
        }

        if( value.length === 0 ) {
            // invalid input, can't have an empty value
            isValidInput = false;
        }

        inputFromFilterString[ field ] = value;
    }

    return {
        input: inputFromFilterString,
        isValidInput: isValidInput
    };
};

/**
 * Show message that there are no results found.
 * @param {Object} filterString the search string for the org tree.
 *
 * @return {String} Object containing the parsed input
 */
export let parseFilterInput = function( filterString ) {
    filterString = filterString.trim();
    var advancedSearch = false;
    if( _.includes( filterString, ':' ) && !( filterString.charAt( 0 ) === '"' && filterString.charAt( filterString.length - 1 ) === '"' ) ) {
        advancedSearch = true;
    }
    var inputData = {
        input: {
            maxToLoad: 1000000,
            maxToReturn: 100000,
            searchForSubGroup: true,
            startIndex: 0
        }
    };

    var filterData = {};

    // Dictates the character(s) used to escape " in the middle of filter string
    var escapeDoubleQuote = '\\"';
    // RegEx for an unescaped double quote
    var unescapedDoubleQuote = /^\"|.*[^\\]"/;
    // If we are doing an advanced filtering, parse the input using a regex
    if( advancedSearch ) {
        var returnedInput = _getInputFromFilterString( filterString, escapeDoubleQuote, unescapedDoubleQuote );
        var parsedInput = returnedInput.input;
        var isValidInput = returnedInput.isValidInput;
        if( isValidInput === false ) {
            _showUsageMessage( filterString );
            return;
        }

        // remove the quotes if they exist, add implicit wildcards to beginning and end
        inputData.input.groupName = _removeQuotesAddWildcards( parsedInput.group ).string;
        inputData.input.roleName = _removeQuotesAddWildcards( parsedInput.role ).string;
        inputData.input.userName = _removeQuotesAddWildcards( parsedInput.username ).string;
        inputData.input.userId = _removeQuotesAddWildcards( parsedInput.userid ).string;

        var keys = Object.keys( parsedInput );
        for( var i = 0; i < keys.length; i++ ) {
            filterData[ keys[ i ] ] = generateRegex( parsedInput[ keys[ i ] ] );
        }
    } else {
        var newFilterString = _removeQuotesAddWildcards( filterString ).string;

        newFilterString = newFilterString.replace( escapeDoubleQuote, '"' );

        inputData.input.groupName = newFilterString;
        inputData.input.roleName = newFilterString;
        inputData.input.userName = newFilterString;
        inputData.input.userId = newFilterString;

        filterString = filterString.replace( escapeDoubleQuote, '"' );
        var regEx = generateRegex( filterString );

        filterData = {
            group: regEx,
            role: regEx,
            username: regEx,
            userid: regEx
        };
    }
    return {
        inputData: inputData,
        filterData: filterData,
        advancedSearch: advancedSearch
    };
};

export let getUserName = function( uname ) {
    return uname.substring( 0, uname.lastIndexOf( '(' ) ).trim();
};

export let getUserId = function( uid ) {
    return uid.substring( uid.lastIndexOf( '(' ) + 1, uid.lastIndexOf( ')' ) ).trim();
};

/**
 * Determines whether the groupMember returned from getGroupMembership2 SOA meets the filter criteria
 * @param {String} groupName name of the group we are comparing
 * @param {String} roleName name of the role we are comparing
 * @param {String} userName name of the username we are comparing
 * @param {String} userId name of the userid we are comparing
 * @param {Object} filterData contains the regular expressions generated using generateRegex
 * @returns {Boolean} true if the group/role/username/userid all match the filter data
 */
export let meetsFilterCriteria = function( groupName, roleName, userName, userId, filterData ) {
    return ( _.isUndefined( filterData.group ) || filterData.group.test( groupName ) ) && //
        ( _.isUndefined( filterData.role ) || filterData.role.test( roleName ) ) && //
        ( _.isUndefined( filterData.username ) || filterData.username.test( userName ) ) && //
        ( _.isUndefined( filterData.userid ) || filterData.userid.test( userId ) );
};

/**
 *  This method calls the search SOA for the org tree and sets the appropriate tree hierarchy in ctx.orgTreeData
 * @param {String} filterString the string from the org tree filter box
 * @param {Object} data vmdata
 * @returns {Promise} SOA promise
 */
export let doSearch = function( filterString, data ) {
    // clear all expansion states
    tableStateService.clearAllStates( data, Object.keys( data.grids )[ 0 ] );

    // Get selection in the org tree
    var selectedNode = data.selectedTreeNode;

    if( filterString === null ) {
        filterString = '';
    }
    if( !_.isUndefined( filterString ) && filterString !== '' ) {
        var paresedInput = awOrganizationTreeUtils.parseFilterInput( filterString );
        if( _.isUndefined( paresedInput ) ) {
            var deferred = AwPromiseService.instance.defer();
            deferred.resolve( false ); // filteringOrgTree = false
            return deferred.promise;
        }
        var inputData = paresedInput.inputData;
        var filterData = paresedInput.filterData;
        var advancedSearch = paresedInput.advancedSearch;

        return soaService.postUnchecked( 'Internal-AWS2-2013-12-OrganizationManagement',
            'getGroupMembership2', { input: inputData.input }, policyIOverride ).then(
            function( response ) {
                var orgTreeData = appCtxService.getCtx( 'orgTreeData' );

                var selectedNodeFound = false;

                // store orgTreeData in another variable for reuse when the filter is cleared $#
                var prevOrgTreeData = appCtxService.getCtx( 'prevOrgTreeData' );
                if( _.isUndefined( prevOrgTreeData ) || prevOrgTreeData.Site.children.length === 0 ) {
                    appCtxService.updatePartialCtx( 'prevOrgTreeData', orgTreeData );
                    prevOrgTreeData = _.cloneDeep( orgTreeData );
                }

                orgTreeData.Site.node.children = [];
                orgTreeData = {
                    Site: {
                        children: [],
                        hier: {},
                        fullExpansion: false,
                        node: orgTreeData.Site.node
                    }
                };

                var onlyFilteringGroups = !_.isUndefined( filterData.group ) && Object.keys( filterData ).length === 1;

                // Add groups and subgroups to orgTreeData whose hierarchy contains the filter string and mark which nodes need to be expanded
                // This allows all groups/subgroups to be found, even those without a GroupMember returned from the SOA
                // NOTE: If we are filtering for a specific role or user, no need to go through this bit of code because all groups/subgroups with the
                // filtered for role or username or userid will be in the SOA response
                if( !advancedSearch || onlyFilteringGroups  ) {
                    var firstLevelGroups = Object.keys( prevOrgTreeData.Site.hier );
                    var lowest_found = orgTreeData.Site.node;
                    for( var i = 0; i < firstLevelGroups.length; i++ ) {
                        var groupNode = prevOrgTreeData.Site.hier[ firstLevelGroups[ i ] ];
                        var dataReturned = _filterGroups( orgTreeData.Site, groupNode, lowest_found, filterData.group, false, selectedNode, selectedNodeFound );
                        if( dataReturned.addNode ) {
                            orgTreeData.Site.hier[ firstLevelGroups[ i ] ] = dataReturned.currNode;
                            orgTreeData.Site.children.push( dataReturned.currNode.node );
                            _setNodesToExpand( dataReturned.lowest_found, dataReturned.lowest_found.fullName.split( '.' ), //
                                '', '', orgTreeData, data, Object.keys( data.grids )[ 0 ] );
                            selectedNodeFound = dataReturned.selectedNodeFound;
                        }
                    }
                }

                //NOTE: We don't need to go through group members if we are only looking for groups
                // if there are groupmembers returned, update the orgTreeData, otherwise send a message and don't change the tree
                if( response.groupMembers.length > 0 && !onlyFilteringGroups ) {
                    for( var i = 0; i < response.groupMembers.length; i++ ) {
                        var gm = response.groupMembers[ i ];
                        if( gm.group.type === 'Group' ) {
                            for( var j = 0; j < gm.groupMembers.length; j++ ) {
                                var addGroupMember = true;
                                if( advancedSearch === true ) {
                                    addGroupMember = meetsFilterCriteria( gm.group.props.object_string.dbValues[ 0 ], gm.role.props.object_string.dbValues[ 0 ], //
                                        getUserName( gm.groupMembers[ j ].props.user.uiValues[ 0 ] ), getUserId( gm.groupMembers[ j ].props.user.uiValues[ 0 ] ), filterData );
                                }
                                if( addGroupMember === true ) {
                                    var returnedData = awOrganizationTreeUtils.filterGroupMembersInOrgTree( gm, orgTreeData, j, filterData, data, Object.keys( data.grids )[ 0 ], //
                                        selectedNode, selectedNodeFound );
                                    orgTreeData = returnedData.orgTreeData;
                                    selectedNodeFound = returnedData.selectedNodeFound;
                                }
                            }
                        }
                    }
                }

                // if no nodes match the search, show no results found message
                if( orgTreeData.Site.children.length === 0 ) {
                    var deferred = AwPromiseService.instance.defer();
                    _showNoResultsMessage( filterString );
                    deferred.resolve();
                    return deferred.promise;
                }

                // make sure groups are alphebatized
                orgTreeData.Site.children = _.sortBy( orgTreeData.Site.children, [ 'displayName' ] );
                orgTreeData.Site.children.forEach( function( element, index ) {
                    element.childNdx = index;
                } );

                // Update context with new orgTreeData and indicate that filtering is occurring
                appCtxService.updatePartialCtx( 'orgTreeData', orgTreeData );

                // set selection to Site if the previous selection is not available
                if( !selectedNodeFound ) {
                    data.dataProviders.orgTreeTableDataProvider.selectionModel.setSelection( orgTreeData.Site.node );
                }

                //this section triggers expansion of site node and other relevant nodes
                if( orgTreeData.Site.node.isExpanded ) {
                    awOrganizationTreeUtils.expandNode( orgTreeData.Site.node, false );
                }
                setTimeout( function() {
                    awOrganizationTreeUtils.expandNode( orgTreeData.Site.node, true );
                }, 250 );

                var deferred = AwPromiseService.instance.defer();
                deferred.resolve( true ); // filteringOrgTree = true
                return deferred.promise;
            }
        );
    }
    // If the search string is empty, set filter to false in ctx
    // get current org tree data to mark node as expanded
    var orgTreeData = appCtxService.getCtx( 'orgTreeData' );
    var prevOrgTreeData = appCtxService.getCtx( 'prevOrgTreeData' );

    // prevOrgTreeData could be undefined if we haven't filtered before and are filtering with an empty string
    if( !_.isUndefined( prevOrgTreeData ) ) {
        appCtxService.updatePartialCtx( 'orgTreeData', prevOrgTreeData );

        // no need to mark rows as expanded if the selected node is Site or one of the first level groups
        if( selectedNode.id !== 'SiteLevel' && selectedNode.parentId !== 'SiteLevel' ) {
            var groupRoleUser = _getGroupRoleUser( selectedNode );

            // set the selected nodes hierarchy to expand
            _setNodesToExpand( selectedNode, groupRoleUser.groups, groupRoleUser.role, groupRoleUser.user, orgTreeData, data, Object.keys( data.grids )[ 0 ] );
        }

        //NOTE: this section triggers expansion of site node
        if( prevOrgTreeData.Site.node.isExpanded ) {
            awOrganizationTreeUtils.expandNode( prevOrgTreeData.Site.node, false );
        }
        setTimeout( function() {
            awOrganizationTreeUtils.expandNode( prevOrgTreeData.Site.node, true );
        }, 250 );
    }

    var deferred = AwPromiseService.instance.defer();
    deferred.resolve( false ); // filterginOrgTree = false
    return deferred.promise;
};

/**
 * Scrolls to the selected node within the org tree
 * @param {Object} data vmData
 * @param {Object} orgTreeData the node hierarchy for the org tree
 * @param {String} selectedNodeHierarchy the hierarchy string for the current selected node
 */
export let scrollToSelected = function( data, selectedNodeHierarchy ) {
    // hierarchy String for the node that is expanding
    var prevNodeHierarchy = data.orgTreeInput.treeLoadResult.parentNode.hierarchy;
    const ctxOrgTreeData = appCtxService.getCtx( 'orgTreeData' );

    // node in orgTreeData for the current expanding node
    var prevOrgNode = _getParentNodeInHierarchy( data.orgTreeInput.treeLoadResult.parentNode, ctxOrgTreeData );

    // get the hierarchy for the next node that we need to scroll to
    // NOTE: this allows us to scroll to the selected node even if it is nested deep in the tree and we have to wait
    // for the SOA to return at each level
    var substringEndNdx = selectedNodeHierarchy.indexOf( '.', prevNodeHierarchy.length + 1 ) !== -1 ? selectedNodeHierarchy.indexOf( '.', prevNodeHierarchy.length + 1 ) : selectedNodeHierarchy.length;
    var hierarchy = selectedNodeHierarchy.substring( 0, substringEndNdx );

    // uid to save as the row to scroll to
    var rowUids = [];

    // if the hierarchy string is Site, it means the Site node is selected, so we should reset the scroll to Site
    if( hierarchy !== 'Site' ) {
        var hierNode = prevOrgNode.hier[ hierarchy ];

        // if the selected node is in the current org tree hierarchy, scroll to the selected node
        if( !_.isUndefined( hierNode ) ) {
            rowUids.push( hierNode.node.uid );
        }
    } else if( prevNodeHierarchy === 'Site' ) {
        // reset scroll to Site node only on the initial expansion of the site node; prevents the tree from
        // continuously scrolling to Site when the user tries to scroll somewhere else in the tree
        rowUids.push( ctxOrgTreeData.Site.node.uid );
    }

    // scroll to row
    if( rowUids.length > 0 ) {
        eventBus.publish( 'plTable.scrollToRow', {
            gridId: Object.keys( data.grids )[ 0 ],
            rowUids: rowUids
        } );
    }
};

/**
 *  Returns orgTreeData with the newly updated data for the expanded node
 * @param {Object} node currently expanding node from the treeLoadInput
 * @param {Object} orgTreeData org tree data from the context
 * @param {Object} data new data for the expanding node
 *
 * @returns {Object} updated org tree data
 */
export let _setParentNodeInHierarchy = function( node, orgTreeData, data ) {
    // get an array of parent Ids to iterate through the hierarchy; take into account possible subgroups
    var hierarchy = node.hierarchy.split( '.' );
    var id = 'Site';
    var currNode = orgTreeData.Site;
    for( var i = 1; i < hierarchy.length; i++ ) {
        id += '.' + hierarchy[ i ];
        currNode = currNode.hier[ id ];
    }
    // set the new data in the org tree data and return the new orgTreeData
    currNode = data;
    return orgTreeData;
};

/**
 * Remove passed in characters if the filterString starts and ends with it.
 * @param {Object} filterString the search string for the org tree.
 * @param {Object} charToRemove Characters to remove.
 *
 * @return {String} filterString
 */
var removeStartEndChar = function( filterString, charToRemove ) {
    for( var i = 0; i < charToRemove.length; i++ ) {
        var char = charToRemove.charAt( i );
        if( filterString.charAt( 0 ) === char && filterString.charAt( 0 ) === char ) {
            filterString = filterString.substring( 1, filterString.length - 1 );
        }
    }
    return filterString;
};

var _replaceRegExpChars = function( string, char ) {
    var charExp = new RegExp( char, 'g' );
    return string.replace( charExp, char );
};

/**
 * @return{String} User type.
 */
export let getUserType = function() {
    return 'User';
};

/**
 *
 * @param {Object} lowestFound lowest node in this branch of the org tree that contains the search string
 * @param {Array} groups array of displayNames for groups and subgroups
 * @param {String} role diplayName for role
 * @param {String} user displayName for user
 * @param {Object} orgTreeData org tree data
 * @param {Object} vmData viewmodel data
 * @param {String} gridId grid id
 */
export let _setNodesToExpand = function( lowestFound, groups, role, user, orgTreeData, vmData, gridId ) {
    var currNode = orgTreeData.Site;
    var hierarchy = 'Site';
    var index = groups.length - 1;
    while( currNode.node.id !== lowestFound.id ) {
        // set node to expand
        tableStateService.saveRowExpanded( vmData, gridId, currNode.node );

        if( index >= 0 ) {
            // next node should be a group/subgroup
            hierarchy += '.' + groups[ index ] + '_' + 'Group';
            index--;
        } else if( currNode.node.type !== 'Role' ) {
            // next node should be a role (if the current node is already role, then we get user)
            hierarchy += '.' + role + '_' + 'Role';
        } else {
            // next node should be user
            hierarchy += '.' + user + '_' + 'GroupMember';
        }
        currNode = currNode.hier[ hierarchy ];
    }
};

/**
 * Returns the groups, role, and user for the selected node based on the selected node's hierarchy
 * @param {Object} selectedNode ViewModelTreeNode that is currently selected
 * @returns {Object} the groups, role, and user for the selected node
 */
export let _getGroupRoleUser = function( selectedNode ) {
    // split hierarchy of node on . and retrieve groups, role, and user display names
    var hierarchyArray = selectedNode.hierarchy.split( '.' );
    var groups = _.filter( hierarchyArray, function( elem ) {
        return _.endsWith( elem, '_Group' );
    } ).reverse();
    groups.forEach( function( elem, index ) {
        groups[ index ] = elem.substring( 0, elem.lastIndexOf( '_' ) );
    } );

    var role = _.filter( hierarchyArray, function( elem ) {
        return _.endsWith( elem, '_Role' );
    } )[ 0 ];
    role = !_.isUndefined( role ) ? role.substring( 0, role.lastIndexOf( '_' ) ) : '';

    var user = _.filter( hierarchyArray, function( elem ) {
        return _.endsWith( elem, '_GroupMember' );
    } )[ 0 ];
    user = !_.isUndefined( user ) ? user.substring( 0, user.lastIndexOf( '_' ) ) : '';
    return {
        groups: groups,
        role: role,
        user: user
    };
};

export let _removeQuotesAddWildcards = function( string ) {
    if( _.isUndefined( string ) ) {
        return {
            string: '*',
            removeTrailingWildcard: false
        };
    }

    var removeTrailingWildcard = false;
    // if there are " " surrounding the string, remove " " and indicate if we should remove the ending *
    if( string.charAt( 0 ) === '"' && string.charAt( string.length - 1 ) === '"' ) {
        string = removeStartEndChar( string, '\"' );

        if( string.charAt( string.length - 1 ) !== '*' ) {
            string = string.concat( '*' );
            removeTrailingWildcard = true;
        }
    } else {
        if( string.charAt( string.length - 1 ) !== '*' ) {
            string = string.concat( '*' );
        }
    }
    return {
        string: string,
        removeTrailingWildcard: removeTrailingWildcard
    };
};

/**
 * Initializes a node for orgTreeData
 * @param {Object} vmNode node to initialize
 * @returns {Object} initialized object
 */
export let _getInitialObject = function( vmNode ) {
    return {
        children: [],
        hier: {},
        fullExpansion: false,
        node: vmNode
    };
};

/**
 *_nodeIndex method Retruns index of node if exist else return -1
 *
 * @param {String} selectedNodeId current selected node id
 * @param {Array} availableNodes all available childrens of current expanded node
 *
 * @returns {Number} index of node
 */
export let _nodeIndex = function( selectedNodeId, availableNodes ) {
    for( var i = 0; i < availableNodes.length; i++ ) {
        if( selectedNodeId === availableNodes[ i ].id ) {
            return i;
        }
    }
    return -1;
};

/**
 * This generates a regular expression that can be used for
 * @param {String} string string that we will be generating the regex for
 * @returns {RegExp} the formatted regular expression
 */
export let generateRegex = function( string ) {
    var parsedData = awOrganizationTreeUtils._removeQuotesAddWildcards( string );
    string = parsedData.string;

    // remove trailing wildcard if the user did not add it themselves (i.e. it was implicitly added)
    if( parsedData.removeTrailingWildcard ) {
        string = string.substring( 0, string.length - 1 );
    }

    // add '\' before any characters special to reg expressions
    var chars = [ '\\\\', '\\(', '\\)', '\\+', '\\[', '\\]', '\\$', '\\^', '\\|', '\\?', '\\.', '\\{', '\\}', '\\!', '\\=', '\\<' ];
    for( var n = 0; n < chars.length; n++ ) {
        string = _replaceRegExpChars( string, chars[ n ] );
    }

    var regExpString = '^(';
    var splitString = string.split( '*' );
    if( splitString.length > 1 ) {
        for( var i = 0; i < splitString.length; i++ ) {
            regExpString += splitString[ i ] + '.*';
        }
        // remove extra .* from end
        regExpString = regExpString.substring( 0, regExpString.lastIndexOf( '.*' ) );
    } else {
        regExpString += splitString[ 0 ];
    }
    regExpString += ')$';
    return new RegExp( regExpString, 'i' );
};

/**
 * Common method to process response and return err object
 * @param  {Object}  response - response from SOA
 *
 * @return {Object} 'error' object
 */
export let handleSOAResponseError = function( response ) {
    var err;
    if( response && response.partialErrors ) {
        err = soaService.createError( response.partialErrors );
        err.message = '';
        _.forEach( response.partialErrors, function( partialError ) {
            _.forEach( partialError.errorValues, function( object ) {
                err.message += '<BR/>';
                err.message += object.message;
            } );
        } );
    }
    return err;
};

/**
 * Return rejection Promise object from err object
 * @param  {Object}  err - 'error' object
 *
 * @return {Promise} 'rejection' Promise
 */
export let getRejectionPromise = function( err ) {
    var deferred = AwPromiseService.instance.defer();
    deferred.reject( err );
    return deferred.promise;
};

const awOrganizationTreeUtils = {
    loadPropertiesJS,
    loadTableProperties,
    preserveSelection,
    treeNodeSelected,
    expandNode,
    getTreeStructure,
    filterGroupMembersInOrgTree,
    parseFilterInput,
    getUserName,
    getUserId,
    meetsFilterCriteria,
    doSearch,
    scrollToSelected,
    _setParentNodeInHierarchy,
    getUserType,
    _setNodesToExpand,
    _getGroupRoleUser,
    _removeQuotesAddWildcards,
    _getInitialObject,
    _nodeIndex,
    generateRegex,
    handleSOAResponseError,
    getRejectionPromise
};

export default awOrganizationTreeUtils;

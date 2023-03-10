// @<COPYRIGHT>@
// ==================================================
// Copyright 2018.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@
/* global setupNgInjector define
 describe
 beforeEach
 inject
 it
 expect
 spyOn
 Promise
 */
/**
 * @module test/awOrganizationTreeUtilsTest
 */
import awOrganizationTreeUtils from 'js/awOrganizationTreeUtils';
import awTableService from 'js/awTableService';
import soa_kernel_clientDataModel from 'soa/kernel/clientDataModel';
import soa_kernel_soaService from 'soa/kernel/soaService';
import iconService from 'js/iconService';
import appCtxService from 'js/appCtxService';

'use strict';
var _awOrganizationTreeUtils;
var _awTableSvc;
var _cdm;
var _soaService;
var _iconSvc = null;
var _appCtxSvc = null;

describe(
    'Testing awOrganizationTreeUtilsTest',

    function() {
        beforeEach( function() {
            setupNgInjector();

            _awOrganizationTreeUtils = awOrganizationTreeUtils;
            _awTableSvc = awTableService;
            _cdm = soa_kernel_clientDataModel;
            _soaService = soa_kernel_soaService;
            _iconSvc = iconService;
            _appCtxSvc = appCtxService;
        } );

          it( 'Check for awOrganizationTreeUtilsTest initialization', function() {

            expect( _awOrganizationTreeUtils ).toBeTruthy();
            expect( _awOrganizationTreeUtils.loadPropertiesJS ).toBeDefined();
            expect( _awOrganizationTreeUtils.loadTableProperties ).toBeDefined();
            expect( _awOrganizationTreeUtils.preserveSelection ).toBeDefined();
            expect( _awOrganizationTreeUtils.treeNodeSelected ).toBeDefined();
            expect( _awOrganizationTreeUtils.getTreeStructure ).toBeDefined();
            expect( _awOrganizationTreeUtils._setParentNodeInHierarchy ).toBeDefined();
            expect( _awOrganizationTreeUtils._setNodesToExpand ).toBeDefined();
            expect( _awOrganizationTreeUtils._getGroupRoleUser ).toBeDefined();
            expect( _awOrganizationTreeUtils._removeQuotesAddWildcards ).toBeDefined();
            expect( _awOrganizationTreeUtils._nodeIndex ).toBeDefined();
            expect( _awOrganizationTreeUtils.handleSOAResponseError ).toBeDefined();
        } );

        it( 'Testing : treeNodeSelected', function() {
            var data = {
                dataProviders: {
                    orgTreeTableDataProvider: {
                        viewModelCollection: {
                            loadedVMObjects: [ {
                                    id: 'SiteLevel',
                                    type: 'Site'
                                },
                                {
                                    id: 'dba',
                                    type: 'group'
                                }
                            ]
                        }
                    }
                }
            };
            var currentNode = {
                parentID: 'SiteLevel',
                levelNdx: 1
            };
            var ctx = {
                parents: [ {
                        id: 'SiteLevel',
                        type: 'Site'
                    },
                    {
                        id: 'dba',
                        type: 'group'
                    }
                ]
            };

            jest.spyOn( _appCtxSvc, 'getCtx' ).mockReturnValue( false );

            _awOrganizationTreeUtils.treeNodeSelected( data, ctx, currentNode );

            expect( ctx.parents.length ).toEqual( 2 );
            expect( ctx.parents[ 0 ].id ).toEqual( 'SiteLevel' );

            data = {
                dataProviders: {
                    orgTreeTableDataProvider: {
                        viewModelCollection: {
                            loadedVMObjects: [ {
                                    id: 'SiteLevel',
                                    type: 'Site'
                                },
                                {
                                    id: 'dba',
                                    type: 'group'
                                }
                            ]
                        },
                        selectionModel: {
                            setSelection: function() {
                                return true;
                            }
                        }
                    }
                },
                orgTreeInput: {
                    treeLoadResult: {
                        parentNode: {
                            id: 12
                        }
                    }
                }
            };
            currentNode = {
                parent_Id: 'SiteLevel',
                levelNdx: 1

            };

            ctx = {
                parents: [ {
                        id: 'SiteLevel',
                        type: 'Site'
                    },
                    {
                        id: 'dba',
                        type: 'group'
                    }
                ],
                selectedTreeNode: {
                    id: 12
                }
            };
            currentNode = null;

            _awOrganizationTreeUtils.treeNodeSelected( data, ctx, currentNode );

            expect( ctx.parents.length ).toEqual( 2 );
            expect( ctx.parents[ 1 ].id ).toEqual( 'dba' );
            expect( ctx.parents[ 1 ].type ).toEqual( 'group' );

            data = {
                dataProviders: {
                    orgTreeTableDataProvider: {
                        viewModelCollection: {
                            loadedVMObjects: [ {
                                    id: 'SiteLevel',
                                    type: 'Site'
                                },
                                {
                                    id: 'dba',
                                    typr: 'group'
                                }
                            ]
                        },
                        selectionModel: {
                            setSelection: function() {
                                return true;
                            }
                        }
                    }
                },
                orgTreeInput: {
                    treeLoadResult: {
                        parentNode: {
                            id: 12
                        },
                        childNodes: [ {} ]
                    }
                }
            };
            currentNode = null;

            ctx = {
                parents: [ {
                        id: 'SiteLevel',
                        type: 'Site'
                    },
                    {
                        id: 'dba',
                        type: 'group'
                    }
                ],
                selectedTreeNode: {
                    id: 14,
                    childNdx: 0
                }
            };

            _awOrganizationTreeUtils.treeNodeSelected( data, ctx, currentNode );

            expect( ctx.parents[ 1 ].id ).toEqual( 'dba' );
            expect( ctx.selectedTreeNode.id ).toEqual( 14 );
            expect( ctx.selectedTreeNode.childNdx ).toEqual( 0 );
        } );

        it( 'Testing : loadPropertiesJS is loading properties', function() {
            var viewModelCollection = {
                getLoadedViewModelObjects: function() {
                    return true;
                }
            };
            var data = {
                dataProviders: {
                    orgTreeTableDataProvider: {}
                }
            };
            data.dataProviders.orgTreeTableDataProvider.getViewModelCollection = function() {
                return viewModelCollection;
            };
            jest.spyOn( _awTableSvc, 'findPropertyLoadInput' ).mockReturnValue( {} );
            jest.spyOn( _awOrganizationTreeUtils, 'loadTableProperties' ).mockReturnValue( {} );

            _awOrganizationTreeUtils.loadPropertiesJS( data );
        } );

        it( 'Testing : loadTableProperties', function() {
            jest.spyOn( _awTableSvc, 'createPropertyLoadResult' ).mockReturnValue( {
                updatedNodes: []
            } );

            var propertyLoadInput = {
                propertyLoadRequests: [ {
                    childNodes: [ {
                        id: 'Site'
                    } ]
                } ]
            };

            _awOrganizationTreeUtils.loadTableProperties( propertyLoadInput );
            expect( propertyLoadInput.propertyLoadRequests[ 0 ].childNodes[ 0 ].id ).toEqual( 'Site' );
        } );

        it( 'Testing : getTreeStructure is returning correct treestructure :_buildTreeTableStructure -> _buildSiteLevelTreeStructure', function() {
            var treeNodeInput = {
                parentNode: {
                    levelNdx: -1
                }
            };
            jest.spyOn( _awTableSvc, 'findTreeLoadInput' ).mockReturnValue( treeNodeInput );
            jest.spyOn( _awTableSvc, 'validateTreeLoadInput' ).mockReturnValue( null );

            var ctx = {
                orgTreeData: {}
            };
            _awOrganizationTreeUtils.getTreeStructure( ctx );

            expect( treeNodeInput.parentNode.levelNdx ).toEqual( -1 );
        } );


        it( 'Testing : getTreeStructure is returning correct treestructure  : _buildTreeTableStructure -> _buildGroupsAndSubgroupsTreeStructure', function() {
            var treeNodeInput = {
                parentNode: {
                    levelNdx: 0,
                    fullName: 'Site',
                    id: 'SiteLevel',
                    displayName: 'Site',
                    hierarchy: 'Site'
                }
            };

            var response = {
                ServiceData: {},
                hierDataMap: [
                    [],
                    [ {
                            group: {
                                props: {
                                    object_string: {
                                        dbValues: [ '4G Tester' ]
                                    }
                                },
                                type: 'Group',
                                uid: 'xMTt6qzvJcQ1UA'
                            },
                            parent: {
                                className: 'unknownClass'
                            }
                        },
                        {
                            group: {
                                props: {
                                    object_string: {
                                        dbValues: [ '4G Tester 2' ]
                                    }
                                },
                                type: 'Group',
                                uid: 'o7Rt6q4xJcQ1UA'
                            },
                            parent: {
                                className: 'unknownClass'
                            }
                        },
                        {
                            group: {
                                props: {
                                    object_string: {
                                        dbValues: [ 'ACE_dba' ]
                                    }
                                },
                                type: 'Group',
                                uid: 'Kdat6q4xJcQ1UA'
                            },
                            parent: {
                                className: 'unknownClass'
                            }
                        }
                    ]
                ]
            };

            jest.spyOn( _awTableSvc, 'findTreeLoadInput' ).mockReturnValue( treeNodeInput );
            jest.spyOn( _awTableSvc, 'validateTreeLoadInput' ).mockReturnValue( null );
            jest.spyOn( _soaService, 'postUnchecked' ).mockReturnValue( Promise.resolve( response ) );
            jest.spyOn( _iconSvc, 'getTypeIconURL' ).mockReturnValue( {} );

            var ctx = {
                orgTreeData: {
                    Site: {
                        children: [],
                        fullExpansion: false
                    }
                }
            };

            _awOrganizationTreeUtils.getTreeStructure( ctx );

            expect( response.hierDataMap[ 1 ].length ).toEqual( 3 );
            expect( response.hierDataMap[ 1 ][ 0 ].group.props.object_string.dbValues[ 0 ] ).toEqual( '4G Tester' );
        } );


it( 'Testing : getTreeStructure is returning correct treestructure  : _buildTreeTableStructure -> _buildSubGroupRoleUserTreeStructure -> filter SubGroups and Roles', function() {
    var treeNodeInput = {
        parentNode: {
            levelNdx: 1,
            type: 'Group',
            fullName: 'ADM_GROUP5',
            hierarchy: 'Site.ADM_GROUP5',
        },
        Site: {
            children: [ {} ],
           fullExpansion: true,
           hier: {
               'Site.ADM_GROUP5': {
                   children: [ {} ],
                   fullExpansion: true,
                   hier: {}
               }
           }
        }
    };
    var data ={
        data:{
            filteringOrgTree:false
        }
    };

    var response = {
        response:[
            {
                values:{
                    values:[
                        '0'
                    ]
                }
            }
        ],
        ServiceData: {},
        groupElementMap: [
            [],
            [ {
                    group: {
                        props: {
                            object_string: {
                                dbValues: [ 'ADM_SUBGROUP1.ADM_GROUP5' ]
                            }
                        },
                        type: 'Group'
                    },
                    parent: {
                        props: {
                            object_string: {
                                dbValues: [ 'ADM_GROUP5' ]
                            }
                        }
                    }

                },
                {
                    group: {
                        props: {
                            object_string: {
                                dbValues: [ 'ADM_GROUP5' ]
                            }
                        }
                    },
                    roles: [ {
                        props: {
                            object_string: {
                                dbValues: [ 'ADM_SUBGROUP1.ADM_GROUP5' ]
                            }
                        },
                        type: 'Role'
                    } ]
                }
            ]
        ]
    };
    var ctx = {
        orgTreeData: {
             Site: {
                 children: [ {} ],
                fullExpansion: true,
                hier: {
                    'Site.ADM_GROUP5': {
                        children: [ {} ],
                        fullExpansion: true,
                        hier: {}
                    }
                }
             }
        }
    };

    jest.spyOn( _awTableSvc, 'findTreeLoadInput' ).mockReturnValue( treeNodeInput );
    jest.spyOn(_appCtxSvc,'getCtx').mockReturnValue(treeNodeInput);
    jest.spyOn( _awTableSvc, 'validateTreeLoadInput' ).mockReturnValue( null );
    jest.spyOn( _soaService, 'postUnchecked' ).mockReturnValue( Promise.resolve( response ) );

    _awOrganizationTreeUtils.getTreeStructure( ctx ,data);

    expect( response.groupElementMap[ 1 ][ 0 ].group.props.object_string.dbValues[ 0 ] ).toEqual( 'ADM_SUBGROUP1.ADM_GROUP5' );
    expect( response.groupElementMap[ 1 ][ 0 ].parent.props.object_string.dbValues[ 0 ] ).toEqual( 'ADM_GROUP5' );
    expect( response.groupElementMap[ 1 ][ 1 ].group.props.object_string.dbValues[ 0 ] ).toEqual( 'ADM_GROUP5' );

    expect( response.groupElementMap[ 1 ][ 1 ].roles.length ).toEqual( 1 );
} );


it( 'Testing : getTreeStructure is returning correct treestructure  : _buildTreeTableStructure -> _buildSubGroupRoleUserTreeStructure -> filter Users ', function() {
    var treeNodeInput = {
        parentNode: {
            levelNdx: 3,
            type: 'Role',
            displayName: 'ADM_ROLE7',
            parentName: 'ADM_SUBGROUP2',
            fullName: 'ADM_ROLE7',
            id: 'org-tree-ADM_SUBGROUP2.ADM_SUBGROUP1.ADM_GROUP5-ADM_ROLE5',
            hierarchy: 'Site.ADM_GROUP5.ADM_SUBGROUP1.ADM_SUBGROUP2.ADM_ROLE5'
        },
        Site: {
            children: [ {} ],
            fullExpansion: true,
            hier: {
                'Site.ADM_GROUP5': {
                    children: [ {} ],
                    fullExpansion: true,
                    hier: {
                        'Site.ADM_GROUP5.ADM_SUBGROUP1': {
                            children: [ {} ],
                            fullExpansion: true,
                            hier: {
                                'Site.ADM_GROUP5.ADM_SUBGROUP1.ADM_SUBGROUP2': {
                                    children: [ {} ],
                                    fullExpansion: true,
                                    hier: {
                                        'Site.ADM_GROUP5.ADM_SUBGROUP1.ADM_SUBGROUP2.ADM_ROLE5': {
                                            children: [ {} ],
                                            fullExpansion: true,
                                            hier: {}
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    };

    var data ={
        data:{
            filteringOrgTree:false
        }
    };
    var response = {
        response:[
            {
                values:{
                    values:[
                        '0'
                    ]
                }
            }
        ],
        ServiceData: {},
        groupElementMap: [
            [],
            [ {
                members: [ {
                    members: [ {
                        type: 'GroupMember',
                        uid: 'RQXx1zYDJcQ1UA',
                        props: {
                            object_string: {
                                dbValues: [ 'ADM_GROUP5/ADM_SUBGROUP1/ADM_SUBGROUP2/ADM_ROLE5/ADM_USER9 (adm_user9)' ]
                            },
                            user: {
                                uiValues: [ 'ADM_USER9 (adm_user9)' ],
                                dbValues: [ 'RMbx1zYDJcQ1UA' ],
                                propertyDescriptor: {
                                    displayName: 'User'
                                }
                            }
                        }
                    } ]
                } ]
            } ]
        ]
    };

    var ctx = {
        orgTreeData: {
            Site: {
                children: [ {} ],
                fullExpansion: true,
                hier: {
                    'Site.ADM_GROUP5': {
                        children: [ {} ],
                        fullExpansion: true,
                        hier: {
                            'Site.ADM_GROUP5.ADM_SUBGROUP1': {
                                children: [ {} ],
                                fullExpansion: true,
                                hier: {
                                    'Site.ADM_GROUP5.ADM_SUBGROUP1.ADM_SUBGROUP2': {
                                        children: [ {} ],
                                        fullExpansion: true,
                                        hier: {
                                            'Site.ADM_GROUP5.ADM_SUBGROUP1.ADM_SUBGROUP2.ADM_ROLE5': {
                                                children: [ {} ],
                                                fullExpansion: true,
                                                hier: {}
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    };

    jest.spyOn( _awTableSvc, 'findTreeLoadInput' ).mockReturnValue( treeNodeInput );
    jest.spyOn(_appCtxSvc,'getCtx').mockReturnValue(treeNodeInput);
    jest.spyOn( _awTableSvc, 'validateTreeLoadInput' ).mockReturnValue( null );
    jest.spyOn( _soaService, 'postUnchecked' ).mockReturnValue( Promise.resolve( response ) );

    _awOrganizationTreeUtils.getTreeStructure( ctx,data );

    expect( response.groupElementMap[ 1 ][ 0 ].members[ 0 ].members[ 0 ].type ).toEqual( 'GroupMember' );
    expect( response.groupElementMap[ 1 ][ 0 ].members[ 0 ].members[ 0 ].uid ).toEqual( 'RQXx1zYDJcQ1UA' );
    expect( response.groupElementMap[ 1 ][ 0 ].members[ 0 ].members[ 0 ].props.object_string.dbValues[ 0 ] ).toEqual( 'ADM_GROUP5/ADM_SUBGROUP1/ADM_SUBGROUP2/ADM_ROLE5/ADM_USER9 (adm_user9)' );
    expect( response.groupElementMap[ 1 ][ 0 ].members[ 0 ].members[ 0 ].props.user.dbValues[ 0 ] ).toEqual( 'RMbx1zYDJcQ1UA' );
    expect( response.groupElementMap[ 1 ][ 0 ].members[ 0 ].members[ 0 ].props.user.uiValues[ 0 ] ).toEqual( 'ADM_USER9 (adm_user9)' );
} );

it( 'Testing handleSOAResponseError', function() {
    var soaRes = {
        response: {
            modelObjects: {},
            plain: []
        }
    };
    var err = _awOrganizationTreeUtils.handleSOAResponseError( soaRes );
    expect( err ).toBeUndefined();
} );

} );

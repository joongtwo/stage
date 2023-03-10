// Copyright 2022 Siemens Product Lifecycle Management Software Inc.

/* global
setupNgInjector define
 describe
 beforeEach
 inject
 it
 expect
 spyOn
 spyOnProperty
 */

/**
 * JEST Tests for 'removeNBOMServiceTest'
 *
 * @module test/removeNBOMServiceTest
 */

import removeNBOMService from 'js/removeNBOMService';
import appCtxService from 'js/appCtxService';
import localeService from 'js/localeService';
import epRemoveObjectService from 'js/epRemoveObjectService';

'use strict';

describe( 'Testing removeNBOMService', function() {

    beforeEach( function() {
        setupNgInjector();
    } );

    it(" Testing removeNBOM: when role is Service Engineer ", function () {

        const selectedObjectFromTile = {
            vmo: {
                props: {
                    object_string: {
                        dbValues: [
                            'tile_obj'
                        ]
                    }
                },
            },
            uid: 'selected_obj_uid'
        };

        let  epTaskPageContext = {
            collaborationContext: {
                uid: 'ccuid'
            },
            MbomStructureContext:{
                uid: 'scUid',
                vmo: {
                    props: {
                        object_string: {
                            dbValues: [
                                'sbom'
                            ]
                        }
                    }
                }
            }
        };

        jest.spyOn( appCtxService, 'getCtx' ).mockImplementation( function( value ) {
            if( value === 'epTaskPageContext' ) {
                return epTaskPageContext;
            } else if( value === 'userSession.props.role_name.dbValues[0]') {
                return 'Service Engineer';
            }
        } );

        let textBundle= {};
        jest.spyOn( localeService, 'getLoadedText' ).mockImplementation( function( msgFileName) {
            if(msgFileName === 'NBOMTileMessages')
            {
                textBundle = {
                    removeNbomSbomConfirmationMessage: "The SBOM structure {0} will be removed along with the Source BOM structure."
                };
                return textBundle;
            }
            else if(msgFileName === 'AdminMessages')
            {
                textBundle = {
                    removeConfirmationMessage: "Remove {0} from the work package?"
                };
                return textBundle;
            }
        } );

        jest.spyOn( epRemoveObjectService, 'removeObjectFromWorkPackage' ).mockReturnValue( Promise.resolve());
        removeNBOMService.removeNBOM(selectedObjectFromTile);

        expect( localeService ).toBeTruthy();
        expect( localeService.getLoadedText ).toHaveBeenCalled();

    });


    it(" Testing removeNBOM: when role is not a Service Engineer ", function () {

        const selectedObjectFromTile = {
            vmo: {
                props: {
                    object_string: {
                        dbValues: [
                            'tile_obj'
                        ]
                    }
                },
            },
            uid: 'selected_obj_uid'
        };

        let  epTaskPageContext = {
            collaborationContext: {
                uid: 'ccuid'
            },
            MbomStructureContext:{
                uid: 'scUid',
                vmo: {
                    props: {
                        object_string: {
                            dbValues: [
                                'sbom'
                            ]
                        }
                    }
                }
            }
        };

        jest.spyOn( appCtxService, 'getCtx' ).mockImplementation( function( value ) {
            if( value === 'epTaskPageContext' ) {
                return epTaskPageContext;
            } else if( value === 'userSession.props.role_name.dbValues[0]') {
                return 'Not a Service Engineer';
            }
        } );
        let textBundle= {};
        jest.spyOn( localeService, 'getLoadedText' ).mockImplementation( function( msgFileName) {
            if(msgFileName === 'NBOMTileMessages')
            {
                textBundle = {
                    removeNbomSbomConfirmationMessage: "The SBOM structure {0} will be removed along with the Source BOM structure."
                };
                return textBundle;
            }
            else if(msgFileName === 'AdminMessages')
            {
                textBundle = {
                    removeConfirmationMessage: "Remove {0} from the work package?"
                };
                return textBundle;
            }
        } );

        jest.spyOn( epRemoveObjectService, 'removeObjectFromWorkPackage' ).mockReturnValue( Promise.resolve());
        removeNBOMService.removeNBOM(selectedObjectFromTile);

        expect( localeService ).toBeTruthy();
        expect( localeService.getLoadedText ).toHaveBeenCalled();

    });
});

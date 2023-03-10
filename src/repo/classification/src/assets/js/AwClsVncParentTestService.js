// Copyright (c) 2021 Siemens 
/* eslint-disable jsx-a11y/no-static-element-interactions*/
/* eslint-disable react/no-children-prop*/

/*global
 define
 */

/**
 * Defines {@link AwClsVncParentTestService}
 *
 * @module js/AwClsVncParentTestService
 */
import _ from 'lodash';
import AwClsVncContainer from 'viewmodel/AwClsVncContainerViewModel';
import uwPropertyService from 'js/uwPropertyService';

var exports = {};

/**
 * render function for AwClsVncParentTestService
 * @param {*} props context for render function interpolation
 * @returns {JSX.Element} react component
 */
export const AwClsVncParentTestRenderFunction = ( props ) => {
    const { actions, fields, ...prop } = props;
    var data = props.viewModel.data;

    /**
     *  Creates children data to use with testing the VNC links component.
     */
    let setupChildFields = function( childClassName ) {
        var response = [];
        let setupChildrenOnResponse = ( names, response ) => {
            for( var i = 0; i < names.length; i++ ) {
                var childData = {
                    name: names[i],
                    displayName: names[i],
                    typeName: 'STRING',
                    dbValues: [],
                    uiValues: []
                };
                var propertyVal = uwPropertyService.createViewModelProperty( childData.name, childData.displayName,
                    childData.typeName, childData.dbValues, childData.uiValues );
                propertyVal.fielddata = { propertyDisplayName: propertyVal.propertyDisplayName };
                response.push( propertyVal );
            }
        };
        //Mock the SOA return.
        if( childClassName === 'Root Class' ) {
            setupChildrenOnResponse( [ 'Mock Child 1', 'Mock Child 2', 'Mock Child 3', 'Mock Child 4', 'Mock Child 5' ], response );
        } else if ( childClassName === 'Mock Child 1' ) {
            setupChildrenOnResponse( [ 'Mock Child 1A', 'Mock Child 2A' ], response );
        } else if ( childClassName === 'Mock Child 2' ) {
            setupChildrenOnResponse( [ 'Mock Child 1B', 'Mock Child 2B' ], response );
        }
        return response;
    };

    /**
    *  Prepare icos for display in the VNC container.
    * @param {*} data The declarative view model
    * @param {*} ctx  Application context
    */
    let prepareVmo = function( simpleVmo ) {
        var response = {};
        var childInfo = {};
        response = {
            cellHeader1: simpleVmo.className,
            cellHeader2: simpleVmo.className,
            cellProperties: simpleVmo.cellProperties,
            thumbnailURL: simpleVmo.imageUrl,
            type: simpleVmo.type,
            typeIconUrl: simpleVmo.imageUrl,
            hasThumbnail: simpleVmo.iconAvailable,
            identifier: simpleVmo.uid,
            indicators: simpleVmo.indicators,
            navigation: '',
            props: {
                classDescription: simpleVmo.classDescription,
                children: simpleVmo.children,
                typeIconFileUrl: simpleVmo.imageUrl
            }
        };
        return response;
    };

    //Will need to be replaced with SOA call.
    let fetchChildren = ( rootName ) => {
        var response = [];
        var child = {
            className: rootName,
            classDescription: '',
            children: setupChildFields( rootName ),
            imageUrl: 'assets/image/typeFolder48.svg',
            typeIconFileUrl: [ 'assets/image/typeFolder48.svg' ],
            type: 'AbstractClass',
            uid: Math.floor( Math.random() * 10000 + 1 ),
            indicators: [],
            cellProperties: []
        };
        response.push( child );
        if( rootName === 'Root Class' ) {
            var sibling = {
                className: 'Mock Sibling',
                classDescription: '',
                children: setupChildFields( 'Mock Child 2' ),
                imageUrl: 'assets/image/typeFolder48.svg',
                typeIconFileUrl: [ 'assets/image/typeFolder48.svg' ],
                type: 'AbstractClass',
                uid: Math.floor( Math.random() * 10000 + 1 ),
                indicators: [],
                cellProperties: []
            };
            response.push( sibling );
        }
        return response;
    };
    let updateRoot = ( label ) => {
        fields.rootstate.update( { rootString: label } );
    };
    const linkFunc = ( linkName ) => {
        if( linkName ) {
            var unrenderedChildren = fetchChildren( linkName );
            var response = [];
            for( var i = 0; i < unrenderedChildren.length; i++ ) {
                var preparedVmo = prepareVmo( unrenderedChildren[i] );
                const handleClick = ( event ) => {
                    if( event.key && ( event.key !== 'Enter' && event.key !== ' ' ) ) { return; }
                    event.preventDefault();
                    updateRoot( preparedVmo.cellHeader1 );
                };
                // FIXME className='sw-container h-3 w-4', Static HTML elements with event handlers require a role,
                // Do not pass children as props. Instead, nest children between opening & closing tags
                response.push( <div className='sw-container h-3 w-4' onClick={handleClick} onKeyDown={handleClick}><AwClsVncContainer vmo={preparedVmo} root={fields.rootstate} children={preparedVmo.props.children}/></div> );
            }
            return response;
        }
    };
    return (
        <div className='h-12 w-12'>
            {linkFunc( fields.rootstate.value.rootString )}
        </div>
    );
};

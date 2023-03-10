/* eslint-env node */
/* eslint-disable no-implicit-globals */
/* eslint-disable valid-jsdoc */

const _ = require( 'lodash' );
const gulp = require('gulp');
const logger = require( '@swf/tooling/js/logger' );
const util = require( '@swf/tooling/js/util' );

//Generates the api documentation viewer in out/soa/api
gulp.task( 'genSoaApi', cb => {
    require( './build/js/genSoaApi' ).generate( () => {
        if( process.platform === 'win32' ) {
            util.spawn( 'cmd', [ '/c', 'start', 'out/soa/api/index.html' ] )
                .then( cb )
                .catch( logger.pipeErrorHandler );
        } else {
            cb();
        }
    } );
} );

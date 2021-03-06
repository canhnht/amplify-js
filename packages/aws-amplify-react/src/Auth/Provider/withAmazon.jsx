import React, { Component } from 'react';

import { ConsoleLogger as Logger } from '@aws-amplify/core';
import Auth from '@aws-amplify/auth';
import AmplifyTheme from '../../AmplifyTheme';
import { SignInButton } from '../../AmplifyUI';

const logger = new Logger('withAmazon');

export default function withAmazon(Comp) {
    return class extends Component {
        constructor(props) {
            super(props);

            this.initAmazon = this.initAmazon.bind(this);
            this.signIn = this.signIn.bind(this);
            this.federatedSignIn = this.federatedSignIn.bind(this);

            this.state = {};
        }

        signIn() {
            const amz = window.amazon;
            const options = { scope: 'profile' };
            amz.Login.authorize(options, (response) => {
                if (response.error) {
                    logger.debug('Failed to login with amazon: ' + response.error);
                    return;
                }
                
                this.federatedSignIn(response);
            });
        }

        federatedSignIn(response) {
            const { access_token, expires_in } = response;
            const { onStateChange } = this.props;
            const date = new Date();
            const expires_at = expires_in * 1000 + date.getTime();
            if (!access_token) {
                return;
            }

            const amz = window.amazon;
            amz.Login.retrieveProfile((userInfo) => {
                if (!userInfo.success) {
                    logger.debug('Get user Info failed');
                    return;
                }

                const user = {
                    name: userInfo.profile.Name
                }
                if (!Auth || 
                    typeof Auth.federatedSignIn !== 'function' || 
                    typeof Auth.currentAuthenticatedUser !== 'function') {
                    throw new Error('No Auth module found, please ensure @aws-amplify/auth is imported');
                }

                Auth.federatedSignIn('amazon', { token: access_token, expires_at }, user)
                .then(credentials => {
                    return Auth.currentAuthenticatedUser();
                }).then(authUser => {
                    if (onStateChange) {
                        onStateChange('signedIn', authUser);
                    }
                });
            });
        }

        componentDidMount() {
            const { amazon_client_id } = this.props;
            if (amazon_client_id) this.createScript();
        }

        createScript() {
            const script = document.createElement('script');
            script.src = 'https://api-cdn.amazon.com/sdk/login1.js';
            script.async = true;
            script.onload = this.initAmazon;
            document.body.appendChild(script);
        }

        initAmazon() {
            logger.debug('init amazon');
            const { amazon_client_id } = this.props;
            const amz = window.amazon;
            amz.Login.setClientId(amazon_client_id);
        }

        render() {
            const amz = window.amazon;
            return (
                <Comp {...this.props} amz={amz} amazonSignIn={this.signIn} />
            )
        }
    }
}

const Button = (props) => (
    <SignInButton
        id="amazon_signin_btn"
        onClick={props.amazonSignIn}
        theme={props.theme || AmplifyTheme}
    >
        Sign In with Amazon
    </SignInButton>
)

export const AmazonButton = withAmazon(Button);

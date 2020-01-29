import { useMutation, useQuery } from '@apollo/react-hooks';
import gql from 'graphql-tag';
import debounce from 'lodash/debounce';
import withCurrentUser from 'modules/auth/containers/withCurrentUser';
import { IUser } from 'modules/auth/types';
import Spinner from 'modules/common/components/Spinner';
import { Alert } from 'modules/common/utils';
import { queries as messageQueries } from 'modules/inbox/graphql';
import { IMail } from 'modules/inbox/types';
import { mutations, queries } from 'modules/settings/integrations/graphql';
import * as React from 'react';
import MailForm from '../../components/mail/MailForm';
import { IntegrationsQueryResponse } from '../../types';
import {
  defaultCustomerFields,
  defaultMailFields,
  defaultMessageFields
} from './constants';

type Props = {
  integrationId?: string;
  brandId?: string;
  conversationId?: string;
  refetchQueries?: string[];
  fromEmail?: string;
  mailData?: IMail;
  isReply?: boolean;
  isForward?: boolean;
  replyAll?: boolean;
  createdAt?: Date;
  toggleReply?: (toAll?: boolean) => void;
  closeModal?: () => void;
  closeReply?: () => void;
};

type FinalProps = {
  currentUser: IUser;
} & Props;

const MailFormContainer = (props: FinalProps) => {
  const {
    mailData,
    conversationId,
    isReply,
    closeModal,
    closeReply,
    currentUser
  } = props;

  const {
    loading: integrationsQueryLoading,
    error: integrationsQueryError,
    data: integrationsQueryData
  } = useQuery<IntegrationsQueryResponse>(gql(queries.integrations), {
    variables: { kind: 'mail' },
    fetchPolicy: 'network-only'
  }
  );

  const [sendMailMutation, { error: sendMailMutationError }] =
    useMutation(gql(mutations.integrationSendMail), {
      refetchQueries: ['activityLogs']
    });

  if (integrationsQueryLoading) {
    return <Spinner objective={true} />;
  }

  if (integrationsQueryError || sendMailMutationError) {
    return <p>Error!</p>;
  }

  const integrations = integrationsQueryData ? integrationsQueryData.integrations : [];

  const save = ({
    variables,
    optimisticResponse,
    update
  }: {
    variables: any;
    optimisticResponse?: any;
    update?: any;
  }) => {
    return sendMailMutation({ variables, optimisticResponse, update })
      .then(() => {
        Alert.success('You have successfully sent a email');

        if (isReply) {
          debounce(
            () =>
              Alert.info(
                'This email conversation will be automatically moved to a resolved state.'
              ),
            3300
          )();
        }

        if (closeModal) {
          closeModal();
        }
      })
      .catch(e => {
        if (closeModal) {
          closeModal();
        }
      });
  };

  const sendMail = ({ variables }: { variables: any }) => {
    if (!isReply) {
      return save({ variables });
    }

    const email = mailData ? mailData.integrationEmail : '';

    const integrationSendMail = {
      _id: Math.round(Math.random() * -1000000),
      ...defaultMessageFields,
      conversationId,
      content: variables.body,
      customer: {
        ...defaultCustomerFields,
        firstName: email,
        primaryEmail: email
      },
      mailData: {
        ...defaultMailFields,
        bcc: [{ __typename: 'Email', email: variables.bcc }],
        to: [{ __typename: 'Email', email: variables.to }],
        from: [{ __typename: 'Email', email: variables.to }],
        cc: [{ __typename: 'Email', email: variables.cc }],
        body: variables.body,
        subject: variables.subject,
        attachments: variables.attachments,
        integrationEmail: variables.from
      }
    };

    const optimisticResponse = { __typename: 'Mutation', integrationSendMail };

    const update = store => {
      const selector = {
        query: gql(messageQueries.conversationMessages),
        variables: { conversationId, limit: 10 }
      };

      // Read the data from our cache for this query.
      try {
        const data = store.readQuery(selector);
        const messages = data.conversationMessages || [];

        messages.push(integrationSendMail);

        // Write our data back to the cache.
        store.writeQuery({ ...selector, data });

        if (closeReply) {
          closeReply();
        }
      } catch (e) {
        Alert.error(e);
        return;
      }
    };

    // Invoke mutation
    return save({ variables, optimisticResponse, update });
  };

  const updatedProps = {
    ...props,
    sendMail,
    integrations,
    emailSignatures: currentUser.emailSignatures || []
  };

  return <MailForm {...updatedProps} />;
};

export default (withCurrentUser(MailFormContainer));

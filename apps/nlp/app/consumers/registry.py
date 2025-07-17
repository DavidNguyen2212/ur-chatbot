from app.consumers.settings import ConsumerConfig, ConsumerName
from app.consumers.email import send_email
from app.consumers.docs_train import train_documents
from app.consumers.url import crawl_site


CONSUMER_REGISTRY = {
    ConsumerName.EMAIL_SENDER: ConsumerConfig(
        name=ConsumerName.EMAIL_SENDER,
        group_id="nlp-email-group",
        topics=["nlp.email.send"],
        handler_func=send_email,
    ),
    ConsumerName.DOCUMENT_TRAINER: ConsumerConfig(
        name=ConsumerName.DOCUMENT_TRAINER,
        group_id="nlp-document-group",
        topics=["nlp.document.train"],
        handler_func=train_documents,
    ),
    ConsumerName.URL_CRAWLER: ConsumerConfig(
        name=ConsumerName.URL_CRAWLER,
        group_id="nlp-url-group",
        topics=["nlp.url.crawl"],
        handler_func=crawl_site, 
    ),
}
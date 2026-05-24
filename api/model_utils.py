import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.metrics.pairwise import cosine_similarity
import re
import os
import warnings
warnings.filterwarnings('ignore')

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_PATH = os.path.join(BASE_DIR, 'data', 'processed', 'dataset_final.csv')
SLANG_PATH = os.path.join(BASE_DIR, 'data', 'processed', 'slang_dict.csv')

print("Loading data...")
df = pd.read_csv(DATA_PATH)
slang_dict = pd.read_csv(SLANG_PATH) if os.path.exists(SLANG_PATH) else pd.DataFrame(columns=['slang', 'standard'])
slang_map = dict(zip(slang_dict['slang'], slang_dict['standard']))

def preprocess(text, slang_map):
    text = str(text).lower()
    text = re.sub(r'[^a-zA-Zàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ0-9\s]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    words = text.split()
    words = [slang_map.get(w, w) for w in words]
    return ' '.join(words)

# Preprocess whole message column
df['message_clean'] = df['message'].apply(lambda x: preprocess(x, slang_map))

print("Training models...")
customer_df = df[df['speaker'] == 'customer'].copy()

tfidf = TfidfVectorizer(max_features=3000, min_df=2, max_df=0.95, ngram_range=(1, 2))
X_all = tfidf.fit_transform(customer_df['message_clean'])

conv_text = customer_df.groupby('conv_id').agg(
    text=('message_clean', lambda x: ' '.join(x.dropna().astype(str))),
    satisfaction=('final_satisfaction', 'first'),
    topic=('topic_name', 'first')
).reset_index()
conv_text = conv_text[conv_text['text'].str.strip() != '']

X_conv = tfidf.transform(conv_text['text'])

nb_model = MultinomialNB(alpha=1.0)
nb_model.fit(X_conv, conv_text['satisfaction'])

agent_responses = []
for conv_id in df['conv_id'].unique():
    conv = df[df['conv_id'] == conv_id]
    customer_msgs = ' '.join(conv[conv['speaker'] == 'customer']['message_clean'].dropna().astype(str))
    agent_msgs = conv[conv['speaker'] == 'agent']['message'].tolist()
    topic = conv['topic_name'].iloc[0] if 'topic_name' in conv.columns else 'Unknown'
    
    if customer_msgs.strip() and agent_msgs:
        agent_responses.append({
            'conv_id': conv_id,
            'customer_text': customer_msgs,
            'agent_response': agent_msgs[0],
            'topic': topic
        })

response_df = pd.DataFrame(agent_responses)
X_responses = tfidf.transform(response_df['customer_text'])
print("Models trained successfully!")

IMAGE_MAP = {
    'giao hàng': 'assets/suggestion_images/giao_hang.png',
    'hoàn tiền': 'assets/suggestion_images/hoan_tien.png',
    'đổi trả': 'assets/suggestion_images/doi_tra.png',
    'kỹ thuật': 'assets/suggestion_images/ky_thuat.png',
    'thanh toán': 'assets/suggestion_images/thanh_toan.png',
    'bảo hành': 'assets/suggestion_images/bao_hanh.png',
}

def get_image(topic):
    topic_lower = str(topic).lower()
    for key, path in IMAGE_MAP.items():
        if key in topic_lower:
            return path
    return 'assets/suggestion_images/giao_hang.png'

def recommend(query, top_k=3):
    cleaned = preprocess(query, slang_map)
    query_vec = tfidf.transform([cleaned])
    
    satisfaction = nb_model.predict(query_vec)[0]
    
    similarities = cosine_similarity(query_vec, X_responses).flatten()
    top_indices = similarities.argsort()[-top_k:][::-1]
    
    suggestions = []
    for idx in top_indices:
        row = response_df.iloc[idx]
        suggestions.append({
            'response': row['agent_response'],
            'topic': row['topic'],
            'similarity': round(float(similarities[idx]), 4),
            'image': get_image(row['topic'])
        })
    
    main_topic = suggestions[0]['topic'] if suggestions else 'Không xác định'
    
    return {
        'query': query,
        'cleaned': cleaned,
        'predicted_satisfaction': str(satisfaction),
        'topic': main_topic,
        'suggestions': suggestions,
        'image': get_image(main_topic)
    }

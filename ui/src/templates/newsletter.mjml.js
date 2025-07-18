export default `<mjml>
  <mj-head>
    <mj-style inline="inline">
      @media only screen and (max-width: 480px) {
        .center-mobile {
          text-align: center !important;
          display: block !important;
          margin-left: auto !important;
          margin-right: auto !important;
        }
      }
    </mj-style>
  </mj-head>
  <mj-body>
    <mj-raw> <!-- Company Header --> </mj-raw>
    <mj-section background-color="#f0f0f0">
      <mj-column>
        <mj-text
          font-size="30px"
          font-weight="700"
          color="#22223b"
          align="center"
          padding="28px 0 10px 0"
          font-family="'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
          letter-spacing="0.5px"
          line-height="1.1"
          text-transform="none"
          >My Daily Feed</mj-text
        >
      </mj-column>
    </mj-section>
    <mj-raw> <!-- Image Header --> </mj-raw>
    <mj-section
      background-url="https://images.unsplash.com/photo-1464983953574-0892a716854b?auto=format&fit=crop&w=800&q=80"
      background-size="cover"
      background-repeat="no-repeat"
    >
      <mj-column width="600px">
        <mj-text
          align="center"
          color="#fff"
          font-size="36px"
          font-family="Helvetica Neue"
          >{{ title }}</mj-text
        >
        <mj-button
          background-color="#007bff"
          color="#ffffff"
          href="{{ link }}"
          font-size="15px"
          font-weight="600"
          border-radius="24px"
          padding="18px 32px 0 32px"
          align="center"
          inner-padding="12px 12px"
          line-height="1.2"
        >Read More</mj-button>
      </mj-column>
    </mj-section>
    <mj-raw> <!-- Intro text --> </mj-raw>
    <mj-section background-color="#fafafa">
      <mj-column width="400px">
        <mj-text
          font-style="italic"
          font-size="20px"
          font-family="Helvetica Neue"
          color="#626262"
          >{{ summary }}</mj-text
        >
      </mj-column>
    </mj-section>
    {{#each content}}
    <mj-section background-color="#ffffff" padding="24px 0">
      <mj-column width="160px" vertical-align="middle">
        {{#if poster}}
        <mj-image
          width="160px"
          src="{{poster}}"
          alt="Poster for {{title}}"
          padding="0 16px 16px 0"
          border-radius="12px"
          align="center"
        ></mj-image>
        {{/if}}
      </mj-column>
      <mj-column vertical-align="middle">
        <mj-text
          font-size="20px"
          font-weight="bold"
          color="#1a237e"
          font-family="'Helvetica Neue', Arial, sans-serif"
          letter-spacing="0.5px"
          align="center"
          padding="0 0 12px 0"
          >{{ title }}</mj-text
        >
        <mj-text
          font-size="15px"
          color="#444"
          font-family="'Helvetica Neue',Arial,sans-serif"
          padding="0 0 20px 0"
          line-height="1.6"
          letter-spacing="0.1px"
          align="center"
          >{{ summary }}</mj-text
        >
        <mj-button
          background-color="#007bff"
          color="#ffffff"
          href="{{ ../link }}/posts/{{ slug }}"
          font-size="15px"
          font-weight="600"
          border-radius="24px"
          padding="18px 32px 0 32px"
          align="center"
          inner-padding="12px 12px"
          line-height="1.2"
        >Read More</mj-button>
      </mj-column>
    </mj-section>
    {{/each}}
    <mj-section background-color="#fafafa">
      <mj-column width="400px">
        <mj-button
          background-color="#F45E43"
          color="#ffffff"
          href="{{ link }}"
          font-size="15px"
          font-weight="600"
          border-radius="24px"
          padding="18px 32px 0 32px"
          align="center"
          inner-padding="12px 12px"
          line-height="1.2"
        >Learn more</mj-button>
      </mj-column>
    </mj-section>

    {{#if isUserSubscriber}}
    <!-- Unsubscribe Section -->
    <mj-section background-color="#fff">
      <mj-column width="400px">
        <mj-button
          background-color="#e53e3e"
          color="#ffffff"
          href="{{ unsubscribeURL }}"
          font-size="15px"
          font-weight="600"
          border-radius="24px"
          padding="18px 32px 0 32px"
          align="center"
          inner-padding="12px 12px"
          line-height="1.2"
        >Unsubscribe</mj-button>
        <mj-text font-size="12px" color="#888" align="center" padding="8px 0 0 0">
          If you no longer wish to receive these emails, you can unsubscribe at any time.
        </mj-text>
      </mj-column>
    </mj-section>
    {{/if}}
    <mj-raw> <!-- Side image and text --> </mj-raw>
    <mj-section background-color="white">
      <mj-column>
        <mj-image
          width="200px"
          src="https://designspell.files.wordpress.com/2012/01/sciolino-paris-bw.jpg"
        ></mj-image>
      </mj-column>
      <mj-column>
        <mj-text
          font-style="italic"
          font-size="20px"
          font-family="Helvetica Neue"
          color="#626262"
          >Discover more</mj-text
        >
        <mj-text color="#525252"
          >Stay tuned for more curated content and stories every day from My
          Daily Feed.</mj-text
        >
      </mj-column>
    </mj-section>
    <mj-raw> <!-- Icons --> </mj-raw>
    <mj-section background-color="#fbfbfb">
      <mj-column>
        <mj-image
          width="100px"
          src="http://191n.mj.am/img/191n/3s/x0l.png"
        ></mj-image>
      </mj-column>
      <mj-column>
        <mj-image
          width="100px"
          src="http://191n.mj.am/img/191n/3s/x01.png"
        ></mj-image>
      </mj-column>
      <mj-column>
        <mj-image
          width="100px"
          src="http://191n.mj.am/img/191n/3s/x0s.png"
        ></mj-image>
      </mj-column>
  </mj-body>
</mjml>`;

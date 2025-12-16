import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3c3Bqa3Bra3Jnc3Jwemdkb2V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1MDc3NzksImV4cCI6MjA3NTA4Mzc3OX0.TBS2mwYwOGhwXzZ1dXiBQk0jzMSxsqkGl7uheogevUE'

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const path = url.pathname

    // Default to index.html
    let filePath = path === '/' ? '/index.html' : path

    // Construct the storage URL
    const supabaseUrl = 'https://ewspjkpkkrgsrpzgdoex.supabase.co'
    const storageUrl = `${supabaseUrl}/storage/v1/object/public${filePath}`

    // Fetch the file from storage with auth
    const storageResponse = await fetch(storageUrl, {
      headers: {
        'Authorization': `Bearer ${ANON_KEY}`,
      },
    })

    if (!storageResponse.ok) {
      // If file not found, try index.html (SPA routing)
      if (filePath !== '/index.html') {
        const indexResponse = await fetch(`${supabaseUrl}/storage/v1/object/public/index.html`, {
          headers: {
            'Authorization': `Bearer ${ANON_KEY}`,
          },
        })

        if (indexResponse.ok) {
          const content = await indexResponse.text()
          // Rewrite asset paths
          const rewrittenContent = content.replace(
            /href="\/assets\//g,
            `href="${supabaseUrl}/storage/v1/object/public/assets/`
          ).replace(
            /src="\/assets\//g,
            `src="${supabaseUrl}/storage/v1/object/public/assets/`
          ).replace(
            /href="\/logo\.png"/g,
            `href="${supabaseUrl}/storage/v1/object/public/logo.png"`
          )

          return new Response(rewrittenContent, {
            headers: {
              ...corsHeaders,
              'Content-Type': 'text/html',
            },
          })
        }
      }

      return new Response('File not found', {
        status: 404,
        headers: corsHeaders,
      })
    }

    // Get the content type based on file extension
    const contentType = getContentType(filePath)
    const content = await storageResponse.text()

    // For HTML files, rewrite asset paths
    let finalContent = content
    if (contentType === 'text/html') {
      finalContent = content.replace(
        /href="\/assets\//g,
        `href="${supabaseUrl}/storage/v1/object/public/assets/`
      ).replace(
        /src="\/assets\//g,
        `src="${supabaseUrl}/storage/v1/object/public/assets/`
      ).replace(
        /href="\/logo\.png"/g,
        `href="${supabaseUrl}/storage/v1/object/public/logo.png"`
      )
    }

    return new Response(finalContent, {
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
      },
    })

  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    })
  }
})

function getContentType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase()

  const contentTypes: Record<string, string> = {
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
  }

  return contentTypes[ext || ''] || 'text/plain'
}